/**
 * Slots a Brand won't use go back into inventory, and the Brand is told why
 * (ADR 0005). A Campaign's Reservations are released when it is rejected,
 * cancelled or deleted, and when it is still unapproved at the approval
 * deadline. There is no scheduler, because the server scales to zero: a
 * deadline release happens whenever the Reservation is next read or its
 * Campaign is next decided. A Slot that has played stays on record.
 */

import { campaignRepository } from '../repositories/CampaignRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { approvalWindowService, storeLocalInstant } from './ApprovalWindowService.js';
import logger from '../utils/logger.js';

export const RELEASE_REASONS = Object.freeze({
    REJECTED: 'campaign_rejected',
    CANCELLED: 'campaign_cancelled',
    DELETED: 'campaign_deleted',
    APPROVAL_DEADLINE: 'approval_deadline',
});

const RELEASE_EXPLANATIONS = {
    [RELEASE_REASONS.REJECTED]: 'the Campaign was rejected',
    [RELEASE_REASONS.CANCELLED]: 'the Campaign was cancelled',
    [RELEASE_REASONS.DELETED]: 'the Campaign was deleted',
    [RELEASE_REASONS.APPROVAL_DEADLINE]:
        'the Campaign was not approved by the approval deadline, 18:00 the day before broadcast',
};

const slotLabel = ({ date, hour, position }) => `${date} ${String(hour).padStart(2, '0')}:00, Slot ${position + 1}`;

const bySlot = (a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.position - b.position;

/** Whether a Reservation's hour is still to play, or playing now, at the Store. */
export function hasNotPlayed(store, { date, hour }, now = new Date()) {
    return now < storeLocalInstant(date, hour + 1, 0, store.time_zone || 'UTC');
}

async function notifyBrand(campaign, released, reason) {
    const count = released.length;
    // Booking for a date closes before its approval deadline, so only an earlier release reopens the Slot.
    const reopened = reason === RELEASE_REASONS.APPROVAL_DEADLINE
        ? ''
        : ` Other Brands can now reserve ${count === 1 ? 'it' : 'them'}.`;
    const message = `${count} Slot Reservation${count === 1 ? '' : 's'} for “${campaign.name || campaign.id}” `
        + `${count === 1 ? 'was' : 'were'} released because ${RELEASE_EXPLANATIONS[reason]}: `
        + `${[...released].sort(bySlot).map(slotLabel).join('; ')}.${reopened}`;
    const users = await userRepository.findBrandUsers(released[0].brand_id);
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

/**
 * Why a held Reservation should no longer be held, or null. A Campaign that
 * can't be read is left alone: a failed read must never release a Slot.
 */
function releaseReason(store, campaign, reservation, now) {
    if (!campaign || !hasNotPlayed(store, reservation, now)) return null;
    if (campaign.status === 'rejected') return RELEASE_REASONS.REJECTED;
    if (campaign.status === 'cancelled') return RELEASE_REASONS.CANCELLED;
    const unapproved = (campaign.status || 'pending_approval') === 'pending_approval';
    if (unapproved && store.time_zone
        && now >= approvalWindowService.normalDeadlineInstant(store, reservation.date)) {
        return RELEASE_REASONS.APPROVAL_DEADLINE;
    }
    return null;
}

/**
 * Releases those of a Store's held Reservations that are due for release, and
 * returns the ones still held. Every reader of held Reservations goes through
 * here, so a deadline passes without a scheduler.
 * @param {object} store
 * @param {Array} reservations - Held Reservations at this Store
 * @param {Date} now
 */
export async function releaseDueReservations(store, reservations, now = new Date()) {
    const campaignIds = [...new Set(reservations.map(reservation => reservation.campaign_id))];
    const loaded = new Map(await Promise.all(campaignIds.map(async id => [id, await campaignRepository.findById(id)])));

    const due = new Map();
    const kept = [];
    for (const reservation of reservations) {
        const campaign = loaded.get(reservation.campaign_id);
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
    return releaseDueReservations(store, await slotReservationRepository.findHeldForStoreAndDate(store.id, date), now);
}

/** A Campaign's held Reservations, grouped by Store. */
async function heldByStore(campaignId) {
    const held = await slotReservationRepository.findHeldForCampaign(campaignId);
    const storeIds = [...new Set(held.map(reservation => reservation.store_id))];
    const stores = await Promise.all(storeIds.map(id => StoreRepository.findById(id)));
    return storeIds.map((id, index) => ({
        store: stores[index] ?? { id },
        reservations: held.filter(reservation => reservation.store_id === id),
    }));
}

/**
 * Releases a Campaign's Slots still to play, as part of rejecting, cancelling
 * or deleting it. Slots that have played stay on record.
 */
export async function releaseCampaignReservations(campaign, reason, now = new Date()) {
    const upcoming = (await heldByStore(campaign.id)).flatMap(({ store, reservations }) =>
        reservations.filter(reservation => hasNotPlayed(store, reservation, now)));
    return releaseForCampaign(campaign, upcoming, reason);
}

/**
 * Releases what a Campaign's approval deadlines have already taken. Called
 * before a decision on the Campaign is saved, so a late approval never keeps a
 * lapsed Slot, whether or not anything read the Slot in between.
 */
export async function releaseLapsedReservations(campaignId, now = new Date()) {
    await Promise.all((await heldByStore(campaignId)).map(({ store, reservations }) =>
        releaseDueReservations(store, reservations, now)));
}
