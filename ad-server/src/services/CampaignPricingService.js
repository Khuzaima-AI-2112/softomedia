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
