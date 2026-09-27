// Records the CPM a Campaign was booked at, so an invoice bills the rate that
// was agreed rather than whatever the configuration says later.

import PricingRepository from '../repositories/PricingRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';

const round = amount => Math.round(amount * 100) / 100;

/** The base CPM for a Retailer, honouring its override. */
function baseCpmFor(config, retailerId) {
    return config.retailerOverrides?.[retailerId]?.baseCPM || config.baseCPM;
}

/**
 * The CPM a Campaign is booked at, from the pricing in force now.
 *
 * Each booked Store is priced at its Retailer's base CPM times that Store's
 * assigned foot-traffic tier. A Campaign booking several Stores is billed at
 * the mean of their rates: the invoice carries one delivered-impression total
 * and cannot attribute impressions to individual Stores. The hour-of-day tier
 * is deliberately not folded in — it varies per Slot, and invoicing has never
 * modelled it.
 *
 * @param {object} args
 * @param {object} args.config - Pricing configuration from getConfig()
 * @param {Map} args.storesById - Booked Stores, keyed by id
 * @param {Array} args.inventorySelection - The Campaign's booked inventory
 * @param {string|null} args.retailerId - Fallback Retailer for a Campaign with no selection
 * @returns {number} The agreed CPM
 */
export function agreedCpmFor({ config, storesById, inventorySelection, retailerId = null }) {
    const selections = Array.isArray(inventorySelection) ? inventorySelection : [];

    if (selections.length === 0) {
        return round(baseCpmFor(config, retailerId));
    }

    const rates = selections.map(selection => {
        const store = storesById.get(selection.store_id);
        const multiplier = PricingRepository.storeTrafficMultiplier(config, store?.cpm_traffic_tier);
        return baseCpmFor(config, selection.retailer_id) * multiplier;
    });

    return round(rates.reduce((total, rate) => total + rate, 0) / rates.length);
}

/** The hour-of-day pricing tier in force on a date: a date override first, then the hour's tier, else medium. */
function hourTierFor(config, date, hour) {
    const overridden = config.dateOverrides?.[date]?.hourlyTiers?.[hour];
    if (overridden && config.trafficTiers?.[overridden]) return overridden;
    const [tier] = Object.entries(config.trafficTiers || {})
        .find(([, candidate]) => candidate.hours?.includes(hour)) || ['medium'];
    return tier;
}

/**
 * The price of one Slot: the Retailer's base CPM times the Store's assigned
 * foot-traffic tier and the hour's pricing tier (and any date multiplier), the
 * same for every position in the hour.
 * @returns {{price: number, tier: string}} The price and the hour's tier
 */
export function slotQuote({ config, retailerId, storeTier, date, hour }) {
    const tier = hourTierFor(config, date, hour);
    const hourMultiplier = config.trafficTiers?.[tier]?.multiplier ?? 1.0;
    const dateMultiplier = config.dateOverrides?.[date]?.multiplier || 1.0;
    const storeMultiplier = PricingRepository.storeTrafficMultiplier(config, storeTier);
    return {
        price: round(baseCpmFor(config, retailerId) * storeMultiplier * hourMultiplier * dateMultiplier),
        tier,
    };
}

/** Loads the pricing and Stores a Campaign's booked rate depends on. */
export async function resolveAgreedCpm(campaign) {
    const config = await PricingRepository.getConfig();
    const selections = Array.isArray(campaign?.inventory_selection) ? campaign.inventory_selection : [];
    const storeIds = [...new Set(selections.map(selection => selection.store_id).filter(Boolean))];
    const stores = await Promise.all(storeIds.map(id => StoreRepository.findById(id)));

    return agreedCpmFor({
        config,
        storesById: new Map(stores.filter(Boolean).map(store => [store.id, store])),
        inventorySelection: selections,
        retailerId: campaign?.retailer_id || null,
    });
}
