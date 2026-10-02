/**
 * Creative Approval (ADR 0007). The Super Administrator approves a Creative
 * once for the whole network. Then each Retailer whose Stores it is booked in
 * approves it once, for its own Stores. A Creative plays in a Store only with
 * both, and neither is asked again for another Campaign or date.
 */

import { CREATIVE_STATUS } from '../constants/creatives.js';
import { ROLES } from '../constants/roles.js';
import { advertiserRepository } from '../repositories/AdvertiserRepository.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import { creativeRepository } from '../repositories/CreativeRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import logger from '../utils/logger.js';

const ENDED_CAMPAIGN_STATUSES = new Set(['rejected', 'cancelled']);

/** Whether the Creative may play in this Retailer's Stores. */
export function isCreativeApprovedFor(creative, retailerId) {
    return creative?.approval_status === CREATIVE_STATUS.APPROVED
        && Boolean(retailerId)
        && creative.retailer_approvals?.[retailerId]?.status === CREATIVE_STATUS.APPROVED;
}

/** The Retailers whose Stores a Campaign books. */
function retailerIdsOf(campaign) {
    const selections = Array.isArray(campaign.inventory_selection) ? campaign.inventory_selection : [];
    const named = selections.map(selection => selection.retailer_id);
    return named.length > 0 ? named : [campaign.retailer_id];
}

/** The Retailers whose Stores a Campaign still running or awaiting a decision books the Creative in. */
export function bookingRetailerIds(creativeId, campaigns) {
    const booked = campaigns
        .filter(campaign => campaign.creative_id === creativeId
            && !campaign.deleted_at
            && !ENDED_CAMPAIGN_STATUSES.has(campaign.status))
        .flatMap(retailerIdsOf);
    return [...new Set(booked.filter(Boolean))];
}

/**
 * Each Retailer's decision on the Creative: every Retailer it is booked with,
 * pending until it decides, and every Retailer that has decided.
 */
export function retailerApprovals(creative, campaigns) {
    const decided = creative.retailer_approvals || {};
    const retailerIds = new Set([...bookingRetailerIds(creative.id, campaigns), ...Object.keys(decided)]);
    return [...retailerIds].map(retailerId => ({
        retailer_id: retailerId,
        status: CREATIVE_STATUS.PENDING,
        decided_by: null,
        decided_at: null,
        reason: null,
        ...decided[retailerId],
    }));
}

/** Whether this Retailer is now asked to decide the Creative. */
export function awaitsRetailer(creative, retailerId, campaigns) {
    return creative.approval_status === CREATIVE_STATUS.APPROVED
        && !creative.retailer_approvals?.[retailerId]
        && bookingRetailerIds(creative.id, campaigns).includes(retailerId);
}

async function notifyAll(users, message) {
    await Promise.all(users.map(user => notificationRepository.notify(user.id, {
        title: 'Creative awaiting approval', message, type: 'info',
    })));
}

async function awaitingMessage(creative) {
    const brand = creative.brand_id ? await advertiserRepository.findById(creative.brand_id) : null;
    return `“${creative.title || creative.id}” from ${brand?.name || 'a Brand'} is waiting for your approval.`;
}

/** Runs a notification; a lost notification never undoes what it reports. */
async function quietly(what, creative, send) {
    try {
        await send();
    } catch (error) {
        logger.error(`[CreativeApproval] Failed to notify ${what}`, { creativeId: creative.id, error: error.message });
    }
}

/** Tells the Super Administrators that a new Creative waits for their decision. */
export function notifyNetworkApprovers(creative) {
    return quietly('the Super Administrators', creative, async () => {
        const users = await userRepository.findByRole(ROLES.SUPERADMIN);
        await notifyAll(users, await awaitingMessage(creative));
    });
}

/** Tells these Retailers' Administrators that the Creative waits for their decision. */
async function notifyRetailers(creative, retailerIds) {
    if (retailerIds.length === 0) return;
    const message = await awaitingMessage(creative);
    const users = await Promise.all(retailerIds.map(retailerId => userRepository.findRetailerUsers(retailerId)));
    await notifyAll(users.flat(), message);
}

const campaignsBooking = creative => campaignRepository.findAll({ where: [['creative_id', '==', creative.id]] });

/** Tells every Retailer now waited on, once the Super Administrator has approved the Creative. */
export function notifyAfterNetworkApproval(creative) {
    return quietly('the Retailers', creative, async () => {
        const retailerIds = bookingRetailerIds(creative.id, await campaignsBooking(creative));
        await notifyRetailers(creative, retailerIds.filter(retailerId => !creative.retailer_approvals?.[retailerId]));
    });
}

/**
 * After a Campaign books an approved Creative: the Retailers it brings in that
 * have neither decided nor been asked through another booking are asked now.
 */
export async function notifyAfterBooking(campaign) {
    if (!campaign.creative_id) return;
    const creative = await creativeRepository.findById(campaign.creative_id).catch(() => null);
    if (creative?.approval_status !== CREATIVE_STATUS.APPROVED) return;
    await quietly('the Retailers', creative, async () => {
        const others = (await campaignsBooking(creative)).filter(other => other.id !== campaign.id);
        const asked = new Set(bookingRetailerIds(creative.id, others));
        await notifyRetailers(creative, bookingRetailerIds(creative.id, [campaign])
            .filter(retailerId => !asked.has(retailerId) && !creative.retailer_approvals?.[retailerId]));
    });
}
