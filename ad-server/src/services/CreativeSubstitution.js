/**
 * A Brand substitutes another of its Creatives into a Campaign, typically after
 * the one it booked was revoked (#38). The Campaign keeps its Slot Reservations:
 * the new Creative fills the same Runs, so it needs as many files. It plays in
 * them once both approvals are given, including in loops already generated.
 */

import { CAMPAIGN_STATUS } from '../constants/campaigns.js';
import { CREATIVE_STATUS } from '../constants/creatives.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import { creativeRepository } from '../repositories/CreativeRepository.js';
import { loopRepository } from '../repositories/LoopRepository.js';
import { mediaRepository } from '../repositories/MediaRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { notifyAfterBooking } from './CreativeApproval.js';
import { hasNotPlayed, settleCampaignReservations } from './ReservationRelease.js';

/** A substitution that can't be made, with the HTTP status that says why. */
export class SubstitutionRefused extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'SubstitutionRefused';
        this.status = status;
    }
}

const NEVER_PLAYS = new Set([CREATIVE_STATUS.REJECTED, CREATIVE_STATUS.REVOKED]);

/** The Creative the Campaign plays now, and its files in play order. */
async function currentFiles(campaign) {
    if (campaign.creative_media_ids?.length) return campaign.creative_media_ids;
    const creative = campaign.creative_id ? await creativeRepository.findById(campaign.creative_id) : null;
    return creative?.media_ids || [campaign.media_id || campaign.asset_id].filter(Boolean);
}

/**
 * Puts the new Creative's files in the Campaign's Slots of loops already
 * generated and still to play, each file in the place of the one it replaces.
 */
async function replaceInGeneratedLoops(campaign, replacing, files, now) {
    const held = await slotReservationRepository.findHeldForCampaign(campaign.id);
    const stores = new Map();
    for (const { store_id: storeId } of held) {
        if (!stores.has(storeId)) stores.set(storeId, await StoreRepository.findById(storeId));
    }
    const hours = new Set(held
        .filter(reservation => stores.get(reservation.store_id) && hasNotPlayed(stores.get(reservation.store_id), reservation, now))
        .map(reservation => `${reservation.store_id}|${reservation.date}|${reservation.hour}`));
    const days = new Set([...hours].map(key => key.split('|').slice(0, 2).join('|')));

    for (const day of days) {
        const [storeId, date] = day.split('|');
        const loops = await loopRepository.findAll({ where: [['store_id', '==', storeId], ['date', '==', date]] });
        for (const loop of loops.filter(candidate => hours.has(`${storeId}|${date}|${candidate.hour}`))) {
            if (!(loop.slots || []).some(slot => slot.campaign_id === campaign.id)) continue;
            const slots = loop.slots.map(slot => {
                if (slot.campaign_id !== campaign.id) return slot;
                const file = files[Math.max(replacing.indexOf(slot.asset_id), 0)];
                return { ...slot, asset_id: file.id, asset_name: file.title || file.filename || null };
            });
            await loopRepository.update(loop.id, { slots });
        }
    }
}

/**
 * Substitutes the Brand's Creative into its Campaign.
 * @param {object} campaign - The Brand's own Campaign
 * @param {string} brandId - The Brand making the substitution
 * @param {string} creativeId - The Creative to play instead
 * @returns {Promise<object>} The Campaign, now booking the new Creative
 * @throws {SubstitutionRefused}
 */
export async function substituteCreative(campaign, brandId, creativeId, now = new Date()) {
    if (campaign.status === CAMPAIGN_STATUS.CANCELLED) {
        throw new SubstitutionRefused('A cancelled Campaign plays no Creative', 409);
    }
    const creative = creativeId ? await creativeRepository.findById(creativeId) : null;
    if (!creative || creative.brand_id !== brandId) throw new SubstitutionRefused('Creative not found', 404);
    if (creative.id === campaign.creative_id) {
        throw new SubstitutionRefused('The Campaign already plays this Creative', 409);
    }
    if (NEVER_PLAYS.has(creative.approval_status)) {
        throw new SubstitutionRefused(`A ${creative.approval_status} Creative can't play`, 409);
    }

    const replacing = await currentFiles(campaign);
    const fileIds = creative.media_ids || [];
    if (fileIds.length !== replacing.length) {
        const count = `${replacing.length} file${replacing.length === 1 ? '' : 's'}`;
        throw new SubstitutionRefused(`The Creative must have ${count}, like the one it replaces`, 400);
    }
    const files = await Promise.all(fileIds.map(id => mediaRepository.findById(id)));
    if (!files.every(Boolean)) throw new SubstitutionRefused('The Creative is missing a file', 409);

    // Deadlines already passed are settled with the Creative the Campaign had then.
    await settleCampaignReservations(campaign.id, now);
    const updated = await campaignRepository.update(campaign.id, {
        creative_id: creative.id,
        media_id: files[0].id,
        ...(campaign.asset_id ? { asset_id: files[0].id } : {}),
        creative_media_ids: fileIds,
        creative_mime_type: files[0].mime_type ?? null,
        creative_duration: files[0].duration ?? null,
    });
    await replaceInGeneratedLoops(campaign, replacing, files, now);
    await notifyAfterBooking(updated);
    return updated;
}
