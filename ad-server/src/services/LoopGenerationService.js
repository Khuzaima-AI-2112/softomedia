/**
 * Loop Generation Service
 * Generates D-1 (day before) broadcast loops
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 * Each loop: 12 ads × 5 seconds = 60 second loop
 */

import { loopRepository, BUSINESS_HOURS, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import { dailyScheduleRepository } from '../repositories/DailyScheduleRepository.js';
import { mediaRepository } from '../repositories/MediaRepository.js';
import { BusinessHoursService } from './BusinessHoursService.js';
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

// Repeating ten-position cadence. Six repetitions form a five-loop
// Allocation Window (60 positions) with the exact accepted 70/20/10 split.
export const ALLOCATION_SEQUENCE = Object.freeze([
    'paid', 'paid', 'retailer', 'paid', 'paid',
    'internal', 'paid', 'paid', 'retailer', 'paid'
]);

export class LoopGenerationService {
    /**
     * Generate all loops for a target date (D-1 scheduling)
     * @param {string} targetDate - Format: YYYY-MM-DD
     * @param {string} retailerId - Target retailer
     * @param {string} storeId - Target Store
     * @returns {Promise<Array>} Generated loops
     */
    async generateDailyLoops(targetDate, retailerId, storeId) {
        const schedule = await this.generateDailySchedule(targetDate, retailerId, storeId);
        return schedule.loops;
    }

    /**
     * Generate loops together with the exact operating-hours decision used.
     */
    async generateDailySchedule(targetDate, retailerId, storeId) {
        const loops = [];

        const effectiveHours = await BusinessHoursService.getEffectiveHours(storeId, targetDate);
        const operatingHours = BusinessHoursService.getOperatingHourRange(effectiveHours);
        const startHour = operatingHours.start;
        const endHour = operatingHours.end;

        logger.info(`[LoopGeneration] Starting D-1 generation for ${targetDate}`, {
            retailerId,
            storeId,
            range: operatingHours.is_closed ? 'closed' : `${startHour}:00 - ${endHour}:00`,
            isClosed: effectiveHours?.is_closed
        });

        const existingSchedule = await dailyScheduleRepository.findByStoreAndDate(storeId, targetDate);
        const previousSchedule = existingSchedule
            ? null
            : await dailyScheduleRepository.findLatestBefore(storeId, targetDate);
        const sequenceStart = existingSchedule?.sequence_start_position
            ?? previousSchedule?.sequence_end_position
            ?? 0;

        if (effectiveHours?.is_closed) {
            await dailyScheduleRepository.save(storeId, targetDate, {
                retailer_id: retailerId,
                is_closed: true,
                operating_hours: [],
                loop_ids: [],
                sequence_start_position: sequenceStart,
                sequence_end_position: sequenceStart,
            });
            return { loops, operatingHours };
        }

        const content = await this.getAvailableContent(retailerId, storeId, targetDate);
        const availableCategories = new Set(content.map(item => item.type));
        const needsFallback = ['paid', 'retailer', 'internal']
            .some(category => !availableCategories.has(category));
        const fallback = needsFallback ? await this.getApprovedFallbackAsset() : null;
        if (needsFallback && !fallback) {
            throw new Error('An approved neutral fallback asset is required for unoccupied reserved positions');
        }

        // Generate loop for each business hour (PARALLELIZED)
        const hourPromises = [];
        for (let hour = startHour; hour < endHour; hour++) {
            const hourOffset = (hour - startHour) * SLOT_CONFIG.SLOTS_PER_LOOP;
            hourPromises.push(this.generateHourlyLoop(
                targetDate,
                hour,
                retailerId,
                storeId,
                content,
                sequenceStart + hourOffset,
                fallback
            ));
        }

        const generatedLoops = await Promise.all(hourPromises);
        loops.push(...generatedLoops);

        await dailyScheduleRepository.save(storeId, targetDate, {
            retailer_id: retailerId,
            is_closed: false,
            operating_hours: loops.map(loop => loop.hour),
            loop_ids: loops.map(loop => loop.id),
            sequence_start_position: sequenceStart,
            sequence_end_position: sequenceStart + loops.length * SLOT_CONFIG.SLOTS_PER_LOOP,
        });

        logger.info(`[LoopGeneration] Generated ${loops.length} loops for ${targetDate}`);
        return { loops, operatingHours };
    }

    /**
     * Generate a single hourly loop
     */
    async generateHourlyLoop(date, hour, retailerId, storeId, content, sequenceStart = 0, fallback = null) {
        const loopId = `${date}_${hour}_${storeId}`;

        // Build 12 slots using priority algorithm
        const slots = this.buildSlots(content, { sequenceStart, fallback });

        const data = {
            date,
            hour,
            retailer_id: retailerId,
            store_id: storeId,
            status: LOOP_STATUS.PENDING_APPROVAL,
            slots
        };
        const existing = await loopRepository.findById(loopId);
        const loop = existing
            ? await loopRepository.update(loopId, data)
            : await loopRepository.create(loopId, data);

        return loop;
    }

    /**
     * Build 12 slots from eligible Campaign and category-media content.
     * @param {Array} content - Eligible content
     * @returns {Array} 12 slots
     */
    buildSlots(content, { sequenceStart = 0, fallback = null } = {}) {
        const prioritized = this.prioritizeContent(content);
        const byCategory = new Map(['paid', 'retailer', 'internal'].map(category => [
            category,
            prioritized.filter(item =>
                item.type?.toLowerCase() === category
            )
        ]));
        const categoryIndexes = { paid: 0, retailer: 0, internal: 0 };

        return Array.from({ length: SLOT_CONFIG.SLOTS_PER_LOOP }, (_, position) => {
            const sequencePosition = sequenceStart + position;
            const allocatedCategory = ALLOCATION_SEQUENCE[sequencePosition % ALLOCATION_SEQUENCE.length];
            const eligible = byCategory.get(allocatedCategory);
            const item = eligible.length > 0
                ? eligible[categoryIndexes[allocatedCategory]++ % eligible.length]
                : null;

            return {
                position,
                allocation_sequence_position: sequencePosition,
                allocated_category: allocatedCategory,
                asset_id: item?.asset_id || fallback?.id || null,
                asset_name: item?.asset_name || fallback?.title || fallback?.filename || null,
                campaign_id: item?.campaign_id ?? null,
                content_kind: item?.content_kind || (item ? 'campaign' : 'fallback'),
                is_fallback: !item,
                duration: SLOT_CONFIG.SLOT_DURATION_SECONDS,
                status: 'PENDING'
            };
        });
    }

    /**
     * Sort eligible content by allocation category priority.
     */
    prioritizeContent(content) {
        return [...content].sort((a, b) => {
            const priorityA = CAMPAIGN_PRIORITY[a.type?.toUpperCase()] || 99;
            const priorityB = CAMPAIGN_PRIORITY[b.type?.toUpperCase()] || 99;
            return priorityA - priorityB;
        });
    }

    /**
     * Get eligible Campaign and category-media content for a Store and date.
     */
    async getAvailableContent(retailerId, storeId, targetDate) {
        try {
            const campaigns = await campaignRepository.findAll({
                where: [['status', '==', 'approved']]
            });

            const media = await mediaRepository.findAll();
            const mediaById = new Map(media.map(asset => [asset.id, asset]));

            const eligibleCampaigns = campaigns.filter(campaign => {
                const selections = Array.isArray(campaign.inventory_selection)
                    ? campaign.inventory_selection
                    : [];
                const matchesTarget = selections.length > 0
                    ? selections.some(selection =>
                        selection.retailer_id === retailerId && selection.store_id === storeId
                    )
                    : (!campaign.retailer_id || campaign.retailer_id === retailerId)
                        && (!campaign.store_id || campaign.store_id === storeId || campaign.store_id === 'ALL');
                const asset = mediaById.get(campaign.media_id || campaign.asset_id);
                return matchesTarget
                    && this.isDateInRange(targetDate, campaign.start_date, campaign.end_date)
                    && this.isApprovedPlaybackAsset(asset);
            }).map(campaign => {
                const asset = mediaById.get(campaign.media_id || campaign.asset_id);
                return {
                    ...campaign,
                    type: (campaign.type || campaign.category || asset?.category || 'paid').toLowerCase(),
                    asset_id: campaign.asset_id || campaign.media_id || asset?.id || null,
                    asset_name: campaign.asset_name || asset?.title || asset?.filename || null,
                    campaign_id: campaign.id,
                };
            }).filter(campaign => campaign.asset_id);

            const categoryMedia = media.filter(asset => {
                const category = asset.category?.toLowerCase();
                const correctOwner = category === 'retailer'
                    ? asset.owner_type === 'retailer' && asset.owner_id === retailerId
                    : category === 'internal' && asset.owner_type === 'platform';
                return this.isApprovedPlaybackAsset(asset) && correctOwner;
            }).map(asset => ({
                id: `media:${asset.id}`,
                type: asset.category.toLowerCase(),
                asset_id: asset.id,
                asset_name: asset.title || asset.filename || null,
                campaign_id: null,
                content_kind: 'media',
            }));

            return [...eligibleCampaigns, ...categoryMedia];
        } catch (error) {
            logger.error('[LoopGeneration] Failed to fetch eligible content', { error: error.message });
            return [];
        }
    }

    async getApprovedFallbackAsset() {
        const assets = await mediaRepository.findAll({
            where: [['category', '==', 'fallback']]
        });
        return assets
            .filter(asset =>
                asset.content_kind === 'neutral_fallback'
                && asset.status !== 'rejected'
                && (asset.eligible_for_playback === true
                    || asset.approval_status === 'approved'
                    || asset.status === 'approved')
            )
            .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
    }

    isApprovedPlaybackAsset(asset) {
        return Boolean(asset) && asset.status !== 'rejected'
            && (asset.eligible_for_playback === true
                || asset.approval_status === 'approved'
                || asset.status === 'approved');
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
    async generateMockLoops(targetDate, retailerId, storeId) {
        const loops = [];

        for (let hour = BUSINESS_HOURS.START; hour < BUSINESS_HOURS.END; hour++) {
            const loopId = `${targetDate}_${hour}_${storeId}`;
            const mockImages = [
                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1920&q=80',
                'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=80',
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1920&q=80',
                'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1920&q=80'
            ];
            const slots = Array.from({ length: SLOT_CONFIG.SLOTS_PER_LOOP }, (_, i) => ({
                position: i,
                url: mockImages[i % mockImages.length],
                asset_id: `mock_asset_${i}`,
                campaign_id: `mock_campaign_${i % 3}`,
                duration: SLOT_CONFIG.SLOT_DURATION_SECONDS,
                status: 'PENDING'
            }));

            const loop = await loopRepository.create(loopId, {
                date: targetDate,
                hour,
                retailer_id: retailerId,
                store_id: storeId,
                status: LOOP_STATUS.PENDING_APPROVAL,
                slots
            });
            loops.push(loop);
        }

        return loops;
    }
}

export const loopGenerationService = new LoopGenerationService();
