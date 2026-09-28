/**
 * Slots a Brand won't use go back into inventory, and the Brand is told why
 * (ADR 0005). A Campaign's Reservations are released when it is rejected or
 * cancelled, and when it is still unapproved at the approval deadline. There is
 * no scheduler, because the server scales to zero: a deadline release happens
 * whenever the Reservation is next read.
 */

import { campaignRepository } from '../repositories/CampaignRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { ROLES, brandIdFor, normalizeRole } from '../constants/roles.js';
import { approvalWindowService } from './ApprovalWindowService.js';
import logger from '../utils/logger.js';

export const RELEASE_REASONS = Object.freeze({
    REJECTED: 'campaign_rejected',
    CANCELLED: 'campaign_cancelled',
    APPROVAL_DEADLINE: 'approval_deadline',
});

const BECAUSE = {
    [RELEASE_REASONS.REJECTED]: 'the Campaign was rejected',
    [RELEASE_REASONS.CANCELLED]: 'the Campaign was cancelled',
    [RELEASE_REASONS.APPROVAL_DEADLINE]: 'the Campaign was not approved by the approval deadline, 18:00 the day before broadcast',
};

const slotLabel = ({ date, hour, position }) => `${date} ${String(hour).padStart(2, '0')}:00, Slot ${position + 1}`;

const bySlot = (a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.position - b.position;

/** The signed-in users who act for this Brand. */
async function brandUsers(brandId) {
    const [linked, members] = await Promise.all([
        userRepository.findAll({ where: [['linked_entity_id', '==', brandId]] }),
        userRepository.findAll({ where: [['organization_id', '==', brandId]] }),
    ]);
    const users = new Map([...linked, ...members].map(user => [user.id, user]));
    return [...users.values()].filter(user => normalizeRole(user.role) === ROLES.BRAND && brandIdFor(user) === brandId);
}

async function notifyBrand(campaign, released, reason) {
    const count = released.length;
    const message = `${count} Slot Reservation${count === 1 ? '' : 's'} for “${campaign.name || campaign.id}” `
        + `${count === 1 ? 'was' : 'were'} released because ${BECAUSE[reason]}: `
        + `${[...released].sort(bySlot).map(slotLabel).join('; ')}. Other Brands can now reserve ${count === 1 ? 'it' : 'them'}.`;
    const users = await brandUsers(released[0].brand_id);
    await Promise.all(users.map(user => notificationRepository.notify(user.id, {
        title: 'Slot Reservation released', message, type: 'warning',
    })));
}

/** Releases a Campaign's Reservations and tells its Brand; a lost notification never undoes a release. */
async function releaseForCampaign(campaign, reservations, reason) {
    const released = await slotReservationRepository.release(reservations, reason);
    if (released.length > 0) {
        try {
            await notifyBrand(campaign, released, reason);
        } catch (error) {
            logger.error('[ReservationRelease] Failed to notify the Brand', { campaignId: campaign.id, error: error.message });
        }
    }
    return released;
}

/** Releases every Reservation a Campaign holds, as part of rejecting or cancelling it. */
export async function releaseCampaignReservations(campaign, reason) {
    return releaseForCampaign(campaign, await slotReservationRepository.findHeldForCampaign(campaign.id), reason);
}

/** The approval deadline for a broadcast date: 18:00 the day before, Store time. */
export const approvalDeadline = (store, date) => approvalWindowService.normalDeadlineInstant(store, date);

/** Why a held Reservation should no longer be held, or null. */
function releaseReason(store, campaign, reservation, now) {
    if (!campaign) return null;
    if (campaign.status === 'rejected') return RELEASE_REASONS.REJECTED;
    if (campaign.status === 'cancelled') return RELEASE_REASONS.CANCELLED;
    const unapproved = (campaign.status || 'pending_approval') === 'pending_approval';
    if (unapproved && store.time_zone && now >= approvalDeadline(store, reservation.date)) {
        return RELEASE_REASONS.APPROVAL_DEADLINE;
    }
    return null;
}

/**
 * Releases those of a Store's held Reservations that are due for release and
 * returns the rest. Every reader of held Reservations goes through here, so a
 * deadline passes without a scheduler.
 */
export async function stillHeld(store, reservations, now = new Date()) {
    const campaignIds = [...new Set(reservations.map(reservation => reservation.campaign_id))];
    const campaigns = new Map(await Promise.all(campaignIds.map(async id => [id, await campaignRepository.findById(id)])));

    const due = new Map();
    const kept = [];
    for (const reservation of reservations) {
        const campaign = campaigns.get(reservation.campaign_id);
        const reason = releaseReason(store, campaign, reservation, now);
        if (!reason) {
            kept.push(reservation);
            continue;
        }
        const key = `${campaign.id}_${reason}`;
        if (!due.has(key)) due.set(key, { campaign, reason, reservations: [] });
        due.get(key).reservations.push(reservation);
    }
    await Promise.all([...due.values()].map(({ campaign, reason, reservations: releasing }) =>
        releaseForCampaign(campaign, releasing, reason)));
    return kept;
}

/** A Store's Reservations for a date that are held now. */
export async function heldReservations(store, date, now = new Date()) {
    return stillHeld(store, await slotReservationRepository.findHeldForStoreAndDate(store.id, date), now);
}
