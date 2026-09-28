/**
 * The Daypart delivery report: Proof of Play counted per Campaign or Retailer
 * promotion and per Daypart (#41).
 *
 * A Proof of Play falls in the Daypart of its Hourly Loop's hour, the Store's
 * local hour, and belongs to the Retailer that owns the Loop's Store. Hours no Daypart covers are counted as outside_dayparts, so each
 * row's total matches its Proof of Play records. Fallback Content is never
 * Campaign delivery and is never counted.
 */

import { DAYPART_NAMES } from './Dayparts.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';

export const OUTSIDE_DAYPARTS = 'outside_dayparts';
export const REPORT_COLUMNS = Object.freeze([...DAYPART_NAMES, OUTSIDE_DAYPARTS]);

function daypartOf(hour, dayparts) {
    return DAYPART_NAMES.find(name => {
        const range = dayparts[name];
        return range && hour >= range.start && hour < range.end;
    }) || OUTSIDE_DAYPARTS;
}

const isCampaignDelivery = proof => proof.playback_kind === 'campaign_delivery'
    && proof.is_fallback !== true
    && Boolean(proof.campaign_id);

/** Whether this scope may see a Proof of Play in this Store's Hourly Loop for this Campaign. */
function inScope(scope, retailerId, campaign) {
    switch (scope?.kind) {
    case 'network': return true;
    case 'brand': return campaignRepository.isOwnedByBrand(campaign, scope.brandId);
    case 'retailer': return Boolean(scope.retailerId) && retailerId === scope.retailerId;
    default: return false;
    }
}

const emptyCounts = () => Object.fromEntries(REPORT_COLUMNS.map(column => [column, 0]));

/**
 * @param {object} input
 * @param {object[]} input.proofs    Proof of Play records
 * @param {object[]} input.loops     the Hourly Loops they were presented in
 * @param {object[]} input.stores    the Stores those Hourly Loops belong to
 * @param {object[]} input.campaigns the Campaigns they delivered
 * @param {object}   input.dayparts  the network's Dayparts
 * @param {object}   input.scope     { kind: 'network' } | { kind: 'brand', brandId } | { kind: 'retailer', retailerId }
 */
export function buildDeliveryReport({ proofs, loops, stores, campaigns, dayparts, scope }) {
    const loopsById = new Map(loops.map(loop => [loop.id, loop]));
    const retailerOfStore = new Map(stores.map(store => [store.id, store.retailer_id]));
    // The Store record decides; a Loop without a Store keeps the Retailer it was generated for.
    const retailerOf = loop => (loop.store_id ? retailerOfStore.get(loop.store_id) : loop.retailer_id) || null;
    const campaignsById = new Map(campaigns.map(campaign => [campaign.id, campaign]));
    const rows = new Map();
    const totals = { ...emptyCounts(), total: 0 };

    for (const proof of proofs) {
        if (!isCampaignDelivery(proof)) continue;
        const loop = loopsById.get(proof.loop_id);
        // Without its Hourly Loop a Proof of Play has no Store or hour to report by.
        if (!loop || !Number.isInteger(loop.hour)) continue;
        const campaign = campaignsById.get(proof.campaign_id);
        if (!inScope(scope, retailerOf(loop), campaign)) continue;

        if (!rows.has(proof.campaign_id)) {
            rows.set(proof.campaign_id, {
                campaign_id: proof.campaign_id,
                campaign_name: campaign?.name || proof.campaign_id,
                is_retailer_promotion: campaign?.type === 'retailer',
                dayparts: emptyCounts(),
                total: 0,
            });
        }
        const row = rows.get(proof.campaign_id);
        const column = daypartOf(loop.hour, dayparts);
        row.dayparts[column] += 1;
        row.total += 1;
        totals[column] += 1;
        totals.total += 1;
    }

    return {
        dayparts,
        columns: REPORT_COLUMNS,
        rows: [...rows.values()].sort((a, b) => a.campaign_name.localeCompare(b.campaign_name)),
        totals,
    };
}
