/**
 * Loop Generation Service
 * Generates D-1 (day before) broadcast loops
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 * Each loop: 12 ads × 5 seconds = 60 second loop
 */

import { loopRepository, BUSINESS_HOURS, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import logger from '../utils/logger.js';

// Slot configuration
export const SLOT_CONFIG = {
    SLOTS_PER_LOOP: 12,
    SLOT_DURATION_SECONDS: 5,
    LOOP_DURATION_SECONDS: 60
};

// Priority order for filling slots
export const CAMPAIGN_PRIORITY = {
    PAID: 1,        // Paid advertiser campaigns
    RETAILER: 2,    // Retailer-owned promotions
    INTERNAL: 3     // Softomedia internal/filler
};

export class LoopGenerationService {
    /**
     * Generate all loops for a target date (D-1 scheduling)
     * @param {string} targetDate - Format: YYYY-MM-DD
     * @param {string} retailerId - Target retailer
     * @param {string} locationId - Target location
     * @returns {Promise<Array>} Generated loops
     */
    async generateDailyLoops(targetDate, retailerId, locationId) {
        const loops = [];

        logger.info(`[LoopGeneration] Starting D-1 generation for ${targetDate}`, {
            retailerId,
            locationId,
            businessHours: `${BUSINESS_HOURS.START}:00 - ${BUSINESS_HOURS.END}:00`
        });

        // Get available campaigns for this retailer/location
        const campaigns = await this.getAvailableCampaigns(retailerId, locationId, targetDate);

        // Generate loop for each business hour
        for (let hour = BUSINESS_HOURS.START; hour < BUSINESS_HOURS.END; hour++) {
            const loop = await this.generateHourlyLoop(targetDate, hour, retailerId, locationId, campaigns);
            loops.push(loop);
        }

        logger.info(`[LoopGeneration] Generated ${loops.length} loops for ${targetDate}`);
        return loops;
    }

    /**
     * Generate a single hourly loop
     */
    async generateHourlyLoop(date, hour, retailerId, locationId, campaigns) {
        const loopId = `${date}_${hour}_${locationId}`;

        // Build 12 slots using priority algorithm
        const slots = this.buildSlots(campaigns, hour);

        const loop = await loopRepository.create(loopId, {
            date,
            hour,
            retailer_id: retailerId,
            location_id: locationId,
            status: LOOP_STATUS.PENDING_APPROVAL,
            slots
        });

        return loop;
    }

    /**
     * Build 12 slots for a loop using campaign priority
     * @param {Array} campaigns - Available campaigns
     * @param {number} hour - Target hour
     * @returns {Array} 12 slots
     */
    buildSlots(campaigns, hour) {
        const slots = [];

        // Sort campaigns by priority
        const sorted = this.prioritizeCampaigns(campaigns);

        // Fill 12 slots
        let campaignIndex = 0;
        for (let position = 0; position < SLOT_CONFIG.SLOTS_PER_LOOP; position++) {
            // Cycle through campaigns if we have fewer than 12
            const campaign = sorted[campaignIndex % sorted.length] || null;

            slots.push({
                position,
                asset_id: campaign?.asset_id || null,
                campaign_id: campaign?.id || null,
                duration: SLOT_CONFIG.SLOT_DURATION_SECONDS,
                status: 'PENDING'
            });

            if (sorted.length > 0) {
                campaignIndex++;
            }
        }

        return slots;
    }

    /**
     * Sort campaigns by priority (Paid > Retailer > Internal)
     */
    prioritizeCampaigns(campaigns) {
        return [...campaigns].sort((a, b) => {
            const priorityA = CAMPAIGN_PRIORITY[a.type?.toUpperCase()] || 99;
            const priorityB = CAMPAIGN_PRIORITY[b.type?.toUpperCase()] || 99;
            return priorityA - priorityB;
        });
    }

    /**
     * Get campaigns available for a retailer/location on a date
     */
    async getAvailableCampaigns(retailerId, locationId, targetDate) {
        try {
            // Get approved campaigns that are active on the target date
            const campaigns = await campaignRepository.findAll({
                where: [['status', '==', 'approved']]
            });

            // Filter by retailer/location assignment and date range
            return campaigns.filter(c => {
                const matchesRetailer = !c.retailer_id || c.retailer_id === retailerId;
                const matchesLocation = !c.location_id || c.location_id === locationId || c.location_id === 'ALL';
                const inDateRange = this.isDateInRange(targetDate, c.start_date, c.end_date);
                return matchesRetailer && matchesLocation && inDateRange;
            });
        } catch (error) {
            logger.error('[LoopGeneration] Failed to fetch campaigns', { error: error.message });
            return [];
        }
    }

    /**
     * Check if date is within campaign date range
     */
    isDateInRange(targetDate, startDate, endDate) {
        if (!startDate || !endDate) return true; // No date restrictions
        return targetDate >= startDate && targetDate <= endDate;
    }

    /**
     * Quick generation for testing - creates mock loops without campaign data
     */
    async generateMockLoops(targetDate, retailerId, locationId) {
        const loops = [];

        for (let hour = BUSINESS_HOURS.START; hour < BUSINESS_HOURS.END; hour++) {
            const loopId = `${targetDate}_${hour}_${locationId}`;
            const slots = Array.from({ length: SLOT_CONFIG.SLOTS_PER_LOOP }, (_, i) => ({
                position: i,
                asset_id: `mock_asset_${i}`,
                campaign_id: `mock_campaign_${i % 3}`,
                duration: SLOT_CONFIG.SLOT_DURATION_SECONDS,
                status: 'PENDING'
            }));

            const loop = await loopRepository.create(loopId, {
                date: targetDate,
                hour,
                retailer_id: retailerId,
                location_id: locationId,
                status: LOOP_STATUS.PENDING_APPROVAL,
                slots
            });
            loops.push(loop);
        }

        return loops;
    }
}

export const loopGenerationService = new LoopGenerationService();
