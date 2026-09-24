/**
 * Per-Store foot-traffic CPM tiers.
 *
 * Mirrors DEFAULT_PRICING.storeTrafficTiers in
 * ad-server/src/repositories/PricingRepository.js — the server is the source of
 * truth, and these values only stand in until its configuration loads.
 *
 * A Store is priced by its explicitly assigned `cpm_traffic_tier`, never by its
 * descriptive `traffic_level`: no Store reprices until an administrator assigns
 * it a tier.
 */
export const DEFAULT_STORE_TRAFFIC_TIERS = Object.freeze({
    low: { multiplier: 0.8, label: 'Low traffic' },
    medium: { multiplier: 1.0, label: 'Standard traffic' },
    high: { multiplier: 1.5, label: 'High traffic' },
});

/** Highest rate first, as the Super Administrator reads them. */
export const STORE_TIER_ORDER = Object.freeze(['high', 'medium', 'low']);

/** The tier an unassigned Store is priced at. */
export const UNASSIGNED_STORE_TIER = Object.freeze({
    key: null,
    multiplier: 1.0,
    label: 'No tier assigned (1.0×)',
});

/** Names a tier honestly even when only its key is known. */
export function storeTierLabel(key) {
    if (!key) return UNASSIGNED_STORE_TIER.label;
    return DEFAULT_STORE_TRAFFIC_TIERS[key]?.label
        || `${key.charAt(0).toUpperCase()}${key.slice(1)} traffic`;
}
