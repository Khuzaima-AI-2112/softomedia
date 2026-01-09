import apiService from './ApiService';

class PricingService {
    constructor() {
        this.config = null;
        this.screens = [];
        this.stores = [];
    }

    /**
     * Initialize PricingService with data from backend
     */
    async init() {
        if (this.config) return;
        try {
            const [configData, screensData, storesData] = await Promise.all([
                apiService.getPricingConfig(),
                apiService.getScreens(),
                apiService.getStores()
            ]);
            this.config = configData;
            this.screens = screensData;
            this.stores = storesData;
        } catch (error) {
            console.error('Failed to initialize PricingService:', error);
            // Fallback to defaults
            this.config = {
                baseCPM: 2.50,
                trafficTiers: {
                    veryLow: { multiplier: 0.5, label: 'Very Low', color: '#94a3b8', hours: [8, 9, 20, 21] },
                    low: { multiplier: 0.75, label: 'Low', color: '#60a5fa', hours: [10, 11, 19] },
                    medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
                    high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
                }
            };
        }
    }

    /**
     * Get the traffic tier for a specific hour
     * @param {number} hour - Hour of the day (0-23)
     * @param {string} date - Optional date for granular overrides
     * @returns {object} Traffic tier info { key, multiplier, label, color }
     */
    getTrafficTier(hour, date = null) {
        const defaultTier = { key: 'medium', multiplier: 1.0, label: 'Medium', color: '#fbbf24' };
        const tiers = this.config?.trafficTiers || this.config?.traffic_tiers;
        if (!tiers) return defaultTier;

        // 1. Check for specific date + hour override
        if (date && this.config?.dateOverrides?.[date]?.hourlyTiers?.[hour]) {
            const tierKey = this.config.dateOverrides[date].hourlyTiers[hour];
            if (tiers[tierKey]) return { key: tierKey, ...tiers[tierKey] };
        }

        // 2. Default to global hour-to-tier mapping
        for (const [key, tier] of Object.entries(tiers)) {
            if (tier.hours && Array.isArray(tier.hours) && tier.hours.includes(hour)) {
                return { key, ...tier };
            }
        }

        // Default to medium if not found
        return tiers.medium ? { key: 'medium', ...tiers.medium } : defaultTier;
    }

    /**
     * Get base CPM for a specific screen, store, or retailer
     * Checks for overrides in order: screen > store > retailer > global
     * @param {string} screenId 
     * @param {string} storeId 
     * @param {string} retailerId 
     * @returns {number} Base CPM in dollars
     */
    getBaseCPM(screenId, storeId, retailerId) {
        if (!this.config) return 2.50;
        const config = this.config;

        // Check screen-level override
        if (screenId && config.screenOverrides?.[screenId]?.baseCPM) {
            return config.screenOverrides[screenId].baseCPM;
        }

        // Check store-level override
        if (storeId && config.storeOverrides?.[storeId]?.baseCPM) {
            return config.storeOverrides[storeId].baseCPM;
        }

        // Check retailer-level override
        if (retailerId && config.retailerOverrides?.[retailerId]?.baseCPM) {
            return config.retailerOverrides[retailerId].baseCPM;
        }

        // Return global base CPM
        return config.baseCPM || config.base_cpm || 2.50;
    }

    /**
     * Get date-specific multiplier for special events/holidays
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {number} Multiplier (1.0 = no change)
     */
    getDateMultiplier(date) {
        if (!this.config) return 1.0;
        return this.config.dateOverrides?.[date]?.multiplier || 1.0;
    }

    /**
     * Calculate the price for a single slot
     * @param {string} screenId 
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @param {number} hour - Hour of the day (0-23)
     * @returns {object} { price, baseCPM, trafficTier, multipliers }
     */
    getSlotPrice(screenId, date, hour) {
        const screen = this.screens.find(s => s.id === screenId);
        if (!screen) {
            return { price: 0, error: 'Screen not found' };
        }

        const store = this.stores.find(s => s.id === screen.store_id);
        const baseCPM = this.getBaseCPM(screenId, screen.store_id, screen.retailer_id);
        const trafficTier = this.getTrafficTier(hour, date);
        const dateMultiplier = this.getDateMultiplier(date);

        // Apply store traffic level bonus
        let storeTrafficMultiplier = 1.0;
        if (store?.traffic_level === 'high') storeTrafficMultiplier = 1.25;
        else if (store?.traffic_level === 'medium') storeTrafficMultiplier = 1.0;
        else if (store?.traffic_level === 'low') storeTrafficMultiplier = 0.8;

        // Final price calculation
        const price = baseCPM * trafficTier.multiplier * dateMultiplier * storeTrafficMultiplier;

        return {
            price: Math.round(price * 100) / 100, // Round to 2 decimal places
            baseCPM,
            trafficTier,
            multipliers: {
                traffic: trafficTier.multiplier,
                date: dateMultiplier,
                storeTraffic: storeTrafficMultiplier
            }
        };
    }

    /**
     * Calculate the price for a full loop (12 slots)
     * @param {string} screenId 
     * @param {string} date 
     * @param {number} hour 
     * @returns {object} { totalPrice, perSlotPrice, slots: 12, ... }
     */
    getLoopPrice(screenId, date, hour) {
        const slotPricing = this.getSlotPrice(screenId, date, hour);

        return {
            ...slotPricing,
            totalPrice: Math.round(slotPricing.price * 12 * 100) / 100,
            perSlotPrice: slotPricing.price,
            slots: 12
        };
    }

    /**
     * Get estimated impressions for a slot based on traffic tier
     * @param {string} screenId 
     * @param {number} hour 
     * @returns {number} Estimated impressions per slot
     */
    getEstimatedImpressions(screenId, hour) {
        const screen = this.screens.find(s => s.id === screenId);
        const store = screen ? this.stores.find(s => s.id === screen.store_id) : null;
        const trafficTier = this.getTrafficTier(hour);

        // Base impressions per slot (5 seconds)
        let baseImpressions = 50; // Assume 50 people see a 5-second ad on average

        // Adjust by traffic tier
        switch (trafficTier.key) {
            case 'veryLow': baseImpressions *= 0.3; break;
            case 'low': baseImpressions *= 0.6; break;
            case 'medium': baseImpressions *= 1.0; break;
            case 'high': baseImpressions *= 1.8; break;
        }

        // Adjust by store traffic level
        if (store?.traffic_level === 'high') baseImpressions *= 1.5;
        else if (store?.traffic_level === 'low') baseImpressions *= 0.7;

        // Adjust by screen type
        if (screen?.type === 'checkout') baseImpressions *= 1.3; // More eyeballs at checkout
        else if (screen?.type === 'entrance') baseImpressions *= 1.2;

        return Math.round(baseImpressions);
    }

    /**
     * Calculate total campaign cost for a set of slot selections
     * @param {Array} selections - Array of { screenId, date, hour, slotCount }
     * @returns {object} { totalCost, totalSlots, totalImpressions, breakdown }
     */
    calculateCampaignTotal(selections) {
        let totalCost = 0;
        let totalSlots = 0;
        let totalImpressions = 0;
        const breakdown = [];

        for (const selection of selections) {
            const { screenId, date, hour, slotCount } = selection;
            const slotPricing = this.getSlotPrice(screenId, date, hour);
            const impressionsPerSlot = this.getEstimatedImpressions(screenId, hour);

            const selectionCost = slotPricing.price * slotCount;
            const selectionImpressions = impressionsPerSlot * slotCount;

            totalCost += selectionCost;
            totalSlots += slotCount;
            totalImpressions += selectionImpressions;

            breakdown.push({
                screenId,
                date,
                hour,
                slotCount,
                pricePerSlot: slotPricing.price,
                totalPrice: Math.round(selectionCost * 100) / 100,
                impressions: selectionImpressions,
                trafficTier: slotPricing.trafficTier
            });
        }

        return {
            totalCost: Math.round(totalCost * 100) / 100,
            totalSlots,
            totalImpressions,
            breakdown,
            averageCPM: totalSlots > 0 ? Math.round((totalCost / totalSlots) * 100) / 100 : 0
        };
    }

    /**
     * Get pricing summary for a date across all screens
     * @param {string} date 
     * @returns {object} Summary with hourly breakdown
     */
    getDailyPricingSummary(date) {
        const screens = this.screens;
        const hours = [];

        const businessHours = { START: 8, END: 22 };

        for (let hour = businessHours.START; hour < businessHours.END; hour++) {
            const trafficTier = this.getTrafficTier(hour, date);
            const dateMultiplier = this.getDateMultiplier(date);

            // Calculate average price across all screens
            let totalPrice = 0;
            let totalImpressions = 0;

            screens.forEach(screen => {
                const pricing = this.getSlotPrice(screen.id, date, hour);
                totalPrice += pricing.price;
                totalImpressions += this.getEstimatedImpressions(screen.id, hour);
            });

            hours.push({
                hour,
                trafficTier,
                dateMultiplier,
                averageSlotPrice: screens.length > 0
                    ? Math.round((totalPrice / screens.length) * 100) / 100
                    : 0,
                totalEstimatedImpressions: totalImpressions
            });
        }

        return {
            date,
            businessHours,
            hourlyBreakdown: hours,
            totalScreens: screens.length
        };
    }

    /**
     * Get slot availability summary (Sync version using provided loop data)
     * @param {object} loop 
     * @returns {object} { available, booked, total, slots }
     */
    getSlotAvailabilityFromLoop(loop) {
        if (!loop) {
            return {
                available: 12,
                booked: 0,
                total: 12,
                slots: Array(12).fill({ status: 'available' })
            };
        }

        return {
            available: loop.slots.filter(s => s.status === 'available').length,
            booked: loop.slots.filter(s => s.status !== 'available').length,
            total: 12,
            slots: loop.slots
        };
    }

    /**
     * Format price for display
     * @param {number} price 
     * @param {string} currency 
     * @returns {string} Formatted price string
     */
    formatPrice(price, currency = 'USD') {
        if (price === undefined || price === null || isNaN(price)) {
            return '$0.00';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    /**
     * Format impressions for display
     * @param {number} impressions 
     * @returns {string} Formatted impressions string (e.g., "1.2K", "3.5M")
     */
    formatImpressions(impressions) {
        if (impressions === undefined || impressions === null || isNaN(impressions)) {
            return '0';
        }
        if (impressions >= 1000000) {
            return `${(impressions / 1000000).toFixed(1)}M`;
        } else if (impressions >= 1000) {
            return `${(impressions / 1000).toFixed(1)}K`;
        }
        return impressions.toString();
    }
}

// Singleton instance
const pricingService = new PricingService();

export default pricingService;
