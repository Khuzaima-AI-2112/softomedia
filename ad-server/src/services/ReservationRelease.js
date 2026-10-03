/**
 * Slots a Brand won't use go back into inventory, and the Brand is told why
 * (ADR 0005). A Campaign's Reservations are released when it is cancelled or
 * deleted. At the approval deadline, a Reservation whose Creative lacks the
 * Super Administrator's approval or the Store's Retailer Approval is released
 * (ADR 0007). There is no scheduler, because the server scales to zero: a
 * deadline release happens whenever the Reservation is next read or its
 * Creative is next approved. A Slot that has played stays on record.
 *
 * A Reservation whose Creative had both approvals at its deadline is kept at
 * it: revoking that Creative or substituting another later never releases it
 * (#38). Each such change settles the deadlines first, so it is recorded.
 */

import { CAMPAIGN_STATUS } from '../constants/campaigns.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import { creativeRepository } from '../repositories/CreativeRepository.js';
import { mediaRepository } from '../repositories/MediaRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { approvalDeadline, storeLocalInstant } from './StoreLocalTime.js';
import { isCreativeApprovedFor } from './CreativeApproval.js';
import logger from '../utils/logger.js';

export const RELEASE_REASONS = Object.freeze({
    CANCELLED: 'campaign_cancelled',
    DELETED: 'campaign_deleted',
    APPROVAL_DEADLINE: 'approval_deadline',
});

const RELEASE_EXPLANATIONS = {
    [RELEASE_REASONS.CANCELLED]: 'the Campaign was cancelled',
    [RELEASE_REASONS.DELETED]: 'the Campaign was deleted',
    [RELEASE_REASONS.APPROVAL_DEADLINE]:
        'its Creative was not approved by both the Super Administrator and the Retailer '
        + 'by the approval deadline, 18:00 the day before broadcast',
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
 * The Creative a Campaign books, null when it has none, or undefined when it
 * can't be read.
 */
async function creativeOf(campaign) {
    try {
        if (campaign.creative_id) return await creativeRepository.findById(campaign.creative_id);
        return await creativeRepository.findForAsset(await mediaRepository.findById(campaign.media_id || campaign.asset_id));
    } catch (error) {
        logger.error('[ReservationRelease] Failed to read the Creative', { campaignId: campaign.id, error: error.message });
        return undefined;
    }
}

/**
 * Why a held Reservation should no longer be held, or null. A Campaign or
 * Creative that can't be read is left alone: a failed read must never release a Slot.
 */
function releaseReason(store, campaign, creative, reservation, now) {
    if (!campaign || !hasNotPlayed(store, reservation, now)) return null;
    if (campaign.status === CAMPAIGN_STATUS.CANCELLED) return RELEASE_REASONS.CANCELLED;
    if (creative !== undefined && !reservation.kept_at_deadline && !isCreativeApprovedFor(creative, store.retailer_id)
        && pastDeadline(store, reservation, now)) {
        return RELEASE_REASONS.APPROVAL_DEADLINE;
    }
    return null;
}

const pastDeadline = (store, reservation, now) => Boolean(store.time_zone)
    && now >= approvalDeadline(store, reservation.date);

/** Whether a held Reservation is now kept at its deadline, its Creative having both approvals there. */
const keptNow = (store, creative, reservation, now) => !reservation.kept_at_deadline && Boolean(creative)
    && isCreativeApprovedFor(creative, store.retailer_id) && pastDeadline(store, reservation, now);

/**
 * Releases those of a Store's held Reservations that are due for release, and
 * returns the ones still held. Every reader of held Reservations goes through
 * here, so a deadline passes without a scheduler.
 * @param {object} store
 * @param {Array} reservations - Held Reservations at this Store
 * @param {Date} now
 * @param {object} [options]
 * @param {boolean} [options.settle] - Also record the ones kept at their deadline
 */
export async function releaseDueReservations(store, reservations, now = new Date(), { settle = false } = {}) {
    const campaignIds = [...new Set(reservations.map(reservation => reservation.campaign_id))];
    const loaded = new Map(await Promise.all(campaignIds.map(async id => {
        const campaign = await campaignRepository.findById(id);
        return [id, { campaign, creative: campaign ? await creativeOf(campaign) : undefined }];
    })));

    const due = new Map();
    const kept = [];
    const keptAtDeadline = [];
    for (const reservation of reservations) {
        const { campaign, creative } = loaded.get(reservation.campaign_id);
        const reason = releaseReason(store, campaign, creative, reservation, now);
        if (!reason) {
            kept.push(reservation);
            if (settle && keptNow(store, creative, reservation, now)) keptAtDeadline.push(reservation);
            continue;
        }
        const key = `${campaign.id}_${reason}`;
        if (!due.has(key)) due.set(key, { campaign, reason, reservations: [] });
        due.get(key).reservations.push(reservation);
    }
    await Promise.all([
        ...[...due.values()].map(({ campaign, reason, reservations: releasing }) =>
            releaseForCampaign(campaign, releasing, reason)),
        ...keptAtDeadline.map(reservation =>
            slotReservationRepository.update(reservation.id, { kept_at_deadline: true })),
    ]);
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
 * Releases a Campaign's Slots still to play, as part of cancelling or deleting
 * it. Slots that have played stay on record.
 */
export async function releaseCampaignReservations(campaign, reason, now = new Date()) {
    const upcoming = (await heldByStore(campaign.id)).flatMap(({ store, reservations }) =>
        reservations.filter(reservation => hasNotPlayed(store, reservation, now)));
    return releaseForCampaign(campaign, upcoming, reason);
}

/** Settles the approval deadlines a Campaign's held Reservations have passed: each is released or kept. */
export async function settleCampaignReservations(campaignId, now = new Date()) {
    const held = await heldByStore(campaignId);
    await Promise.all(held.map(({ store, reservations }) =>
        releaseDueReservations(store, reservations, now, { settle: true })));
}

/**
 * Settles the deadlines of every Campaign booking a Creative. Called before a
 * decision on the Creative is saved, whether or not anything read the Slots in
 * between: a late approval never keeps a lapsed Slot, and a revocation never
 * releases one the Creative was approved for at its deadline.
 */
export async function releaseLapsedReservations(creativeId, now = new Date()) {
    const campaigns = await campaignRepository.findAll({ where: [['creative_id', '==', creativeId]] });
    await Promise.all(campaigns.map(campaign => settleCampaignReservations(campaign.id, now)));
}
