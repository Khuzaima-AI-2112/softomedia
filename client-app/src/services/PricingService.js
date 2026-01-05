/**
 * PricingService - CPM Pricing Calculation Engine
 * Calculates slot prices based on traffic tiers, location, and overrides
 */

import localStorageService, { BUSINESS_HOURS, DEFAULT_TRAFFIC_TIERS } from './LocalStorageService';

class PricingService {

    /**
     * Get the traffic tier for a specific hour
     * @param {number} hour - Hour of the day (0-23)
     * @returns {object} Traffic tier info { key, multiplier, label, color }
     */
    getTrafficTier(hour) {
        const config = localStorageService.getPricingConfig();
        const tiers = config.trafficTiers || DEFAULT_TRAFFIC_TIERS;

        for (const [key, tier] of Object.entries(tiers)) {
            if (tier.hours.includes(hour)) {
                return { key, ...tier };
            }
        }

        // Default to medium if not found
        return { key: 'medium', ...tiers.medium };
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
        const config = localStorageService.getPricingConfig();

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
        return config.baseCPM || 2.50;
    }

    /**
     * Get date-specific multiplier for special events/holidays
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {number} Multiplier (1.0 = no change)
     */
    getDateMultiplier(date) {
        const config = localStorageService.getPricingConfig();
        return config.dateOverrides?.[date]?.multiplier || 1.0;
    }

    /**
     * Calculate the price for a single slot
     * @param {string} screenId 
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @param {number} hour - Hour of the day (0-23)
     * @returns {object} { price, baseCPM, trafficTier, multipliers }
     */
    getSlotPrice(screenId, date, hour) {
        const screen = localStorageService.getScreen(screenId);
        if (!screen) {
            return { price: 0, error: 'Screen not found' };
        }

        const store = localStorageService.getStore(screen.storeId);
        const baseCPM = this.getBaseCPM(screenId, screen.storeId, screen.retailerId);
        const trafficTier = this.getTrafficTier(hour);
        const dateMultiplier = this.getDateMultiplier(date);

        // Apply store traffic level bonus
        let storeTrafficMultiplier = 1.0;
        if (store?.trafficLevel === 'high') storeTrafficMultiplier = 1.25;
        else if (store?.trafficLevel === 'medium') storeTrafficMultiplier = 1.0;
        else if (store?.trafficLevel === 'low') storeTrafficMultiplier = 0.8;

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
        const screen = localStorageService.getScreen(screenId);
        const store = screen ? localStorageService.getStore(screen.storeId) : null;
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
        if (store?.trafficLevel === 'high') baseImpressions *= 1.5;
        else if (store?.trafficLevel === 'low') baseImpressions *= 0.7;

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
        const screens = localStorageService.getScreens();
        const hours = [];

        for (let hour = BUSINESS_HOURS.START; hour < BUSINESS_HOURS.END; hour++) {
            const trafficTier = this.getTrafficTier(hour);
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
            businessHours: { start: BUSINESS_HOURS.START, end: BUSINESS_HOURS.END },
            hourlyBreakdown: hours,
            totalScreens: screens.length
        };
    }

    /**
     * Get slot availability for a screen on a specific date/hour
     * @param {string} screenId 
     * @param {string} date 
     * @param {number} hour 
     * @returns {object} { available, booked, total, slots }
     */
    getSlotAvailability(screenId, date, hour) {
        const loop = localStorageService.getLoopByParams(screenId, date, hour);

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
