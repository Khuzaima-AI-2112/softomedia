import apiService from './ApiService';

class PricingService {
    constructor() {
        this.config = null;
        this.screens = [];
        this.stores = [];
    }

    /**
     * Initialize PricingService with data from backend
     * @param {boolean} forceRefresh - If true, re-fetches all data even if already initialized
     */
    async init(forceRefresh = false) {
        if (this.config && !forceRefresh) return;
        try {
            console.log('[PricingService] Initializing...', { forceRefresh });
            const [configData, screensData, storesData] = await Promise.all([
                apiService.getPricingConfig(),
                apiService.getScreens(),
                apiService.getStores()
            ]);
            this.config = configData;
            this.screens = screensData;
            this.stores = storesData;

            console.log('[PricingService] Initialized with baseCPM:', this.config?.baseCPM, 'screens:', this.screens?.length, 'stores:', this.stores?.length);

            // Validate configuration after loading
            this.validateConfiguration();
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
     * Calculate slot price based on base CPM and active multipliers
     */
    calculateSlotPrice(hour, date, retailerId = null) {
        if (!this.config) return null;

        // 1. Determine Base CPM (Check for Retailer Override first)
        let baseCPM = this.config.baseCPM;
        if (retailerId && this.config.retailerOverrides?.[retailerId]?.baseCPM) {
            baseCPM = this.config.retailerOverrides[retailerId].baseCPM;
            console.log(`[PricingService] Applying Retailer Override for ${retailerId}: $${baseCPM}`);
        }

        // 2. Get Traffic Tier Multiplier
        let tierMultiplier = 1.0;
        const tier = this.getTrafficTier(hour, date); // Use getTrafficTier to get the full tier object
        if (tier) {
            tierMultiplier = tier.multiplier;
        }

        // 3. Get Date Override Multiplier
        let dateMultiplier = 1.0;
        const dateKey = this._formatDateKey(date); // Assuming _formatDateKey exists or will be added
        const dateOverride = this.config.dateOverrides?.[dateKey];
        if (dateOverride) {
            dateMultiplier = dateOverride.multiplier;
        }

        // 4. Calculate Final Price
        // LAYER 3: Removed hidden multipliers (storeTrafficMultiplier)
        const finalPrice = baseCPM * tierMultiplier * dateMultiplier;

        // Log calculation details
        console.log(`[PricingService] Slot Calculation: $${baseCPM} (Base) * ${tierMultiplier}x (Tier: ${tier.key}) * ${dateMultiplier}x (Date: ${dateKey}) = $${finalPrice.toFixed(2)}`);

        return finalPrice;
    }

    /**
     * Helper to format date string for consistent key access
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {string} Formatted date key
     */
    _formatDateKey(date) {
        // Ensure date is in YYYY-MM-DD format
        if (date instanceof Date) {
            return date.toISOString().split('T')[0];
        }
        return date; // Assume it's already in the correct string format
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
     * RULE: Only applies multipliers that are VISIBLE in Super Admin UI
     * - Base CPM (visible in header)
     * - Traffic Tier multiplier (visible in dropdown)
     * - Date Override multiplier (visible in date override section)
     * 
     * REMOVED: Store traffic multiplier (was hidden, caused confusion)
     * 
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

        const baseCPM = this.getBaseCPM(screenId, screen.store_id, screen.retailer_id);
        const trafficTier = this.getTrafficTier(hour, date);
        const dateMultiplier = this.getDateMultiplier(date);

        // SIMPLIFIED: Only visible multipliers
        // Formula: Base CPM × Traffic Tier × Date Multiplier
        const price = baseCPM * trafficTier.multiplier * dateMultiplier;

        // DEBUG: Log calculation details
        console.log(`[PricingService] getSlotPrice: screenId=${screenId}, baseCPM=${baseCPM}, tier=${trafficTier.multiplier}, date=${dateMultiplier}, price=${price.toFixed(2)}`);

        return {
            price: Math.round(price * 100) / 100, // Round to 2 decimal places
            baseCPM,
            trafficTier,
            multipliers: {
                traffic: trafficTier.multiplier,
                date: dateMultiplier
                // NOTE: storeTraffic REMOVED - was hidden from UI
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
    getDailyPricingSummary(date, businessHoursRange = null) {
        const screens = this.screens;
        const hours = [];

        // Use provided range or default to 8-22
        const businessHours = businessHoursRange || { START: 8, END: 22 };

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

    /**
     * CRITICAL: Handle global CPM updates with override refresh
     * @param {object} newConfig 
     */
    async updateConfig(newConfig) {
        if (!newConfig) return;

        console.log('[PricingService] updateConfig called with:', newConfig);

        // If baseCPM changed, must refresh from database to get updated overrides
        if (newConfig.baseCPM !== undefined &&
            newConfig.baseCPM !== this.config?.baseCPM) {

            console.log(
                '[PricingService] Base CPM changed from',
                this.config?.baseCPM,
                'to',
                newConfig.baseCPM,
                '- forcing full refresh'
            );

            // Force complete re-initialization to fetch fresh data from DB
            await this.init(true);
            return;
        }

        // For non-CPM updates, safe merge
        this.config = {
            ...this.config,
            ...newConfig
        };

        // Explicitly update trafficTiers
        if (newConfig.trafficTiers !== undefined) {
            this.config.trafficTiers = newConfig.trafficTiers;
        } else if (newConfig.traffic_tiers !== undefined) {
            this.config.trafficTiers = newConfig.traffic_tiers;
        }

        // Explicitly update dateOverrides
        if (newConfig.dateOverrides !== undefined) {
            this.config.dateOverrides = newConfig.dateOverrides;
        } else if (newConfig.date_overrides !== undefined) {
            this.config.dateOverrides = newConfig.date_overrides;
        }

        // Explicitly update retailerOverrides
        if (newConfig.retailerOverrides !== undefined) {
            this.config.retailerOverrides = newConfig.retailerOverrides;
        } else if (newConfig.retailer_overrides !== undefined) {
            this.config.retailerOverrides = newConfig.retailer_overrides;
        }

        console.log('[PricingService] Config updated:', this.config);

        // Validate after update
        this.validateConfiguration();
    }

    /**
     * CRITICAL: Verify configuration integrity
     * @returns {boolean} True if configuration is valid
     */
    validateConfiguration() {
        if (!this.config) {
            console.error('[PricingService] No configuration loaded');
            return false;
        }

        const { baseCPM, retailerOverrides } = this.config;
        const issues = [];

        // Check base CPM is reasonable
        if (!baseCPM || baseCPM < 0.01 || baseCPM > 1000) {
            issues.push(`Invalid baseCPM: ${baseCPM}`);
        }

        // Check for unusual retailer overrides
        if (retailerOverrides) {
            Object.entries(retailerOverrides).forEach(([retailerId, override]) => {
                const overrideValue = override?.baseCPM || override;
                if (overrideValue && baseCPM) {
                    const discount = ((baseCPM - overrideValue) / baseCPM) * 100;
                    if (discount > 50) {
                        console.warn(
                            `[PRICING_ALERT] Retailer ${retailerId} has extreme discount: ${discount.toFixed(1)}% (override: $${overrideValue}, base: $${baseCPM})`
                        );
                    }
                }
            });
        }

        if (issues.length > 0) {
            console.error('[PRICING_VALIDATION] Issues detected:', issues);
            return false;
        }

        console.log('[PricingService] Configuration validated successfully');
        return true;
    }
}

// Singleton instance
const pricingService = new PricingService();

// Expose globally for debugging (remove in production)
if (typeof window !== 'undefined') {
    window.pricingService = pricingService;
}

export default pricingService;
