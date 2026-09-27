/**
 * Loop Generation Service
 * Generates D-1 (day before) broadcast loops
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 * Each loop: 12 ads × 5 seconds = 60 second loop
 */

import { loopRepository, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import { dailyScheduleRepository } from '../repositories/DailyScheduleRepository.js';
import { mediaRepository } from '../repositories/MediaRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import { BusinessHoursService } from './BusinessHoursService.js';
import logger from '../utils/logger.js';
import {
    isApprovedFallbackAsset,
    isApprovedPlaybackAsset,
} from './PlaybackEligibility.js';
import { allocatedCategory, firstPositionOfHour, SLOTS_PER_LOOP } from './SlotInventory.js';

// Slot configuration
export const SLOT_CONFIG = {
    SLOTS_PER_LOOP,
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

        if (effectiveHours?.is_closed) {
            await dailyScheduleRepository.save(storeId, targetDate, {
                retailer_id: retailerId,
                is_closed: true,
                operating_hours: [],
                loop_ids: [],
            });
            return { loops, operatingHours };
        }

        // Paid positions play only what was reserved (ADR 0005); the shared
        // content fills Retailer and Internal positions.
        const [content, reserved, fallback] = await Promise.all([
            this.getAvailableContent(retailerId, storeId, targetDate),
            this.getReservedCreatives(storeId, targetDate),
            this.getApprovedFallbackAsset(),
        ]);

        // Generate loop for each business hour (PARALLELIZED)
        const hourPromises = [];
        for (let hour = startHour; hour < endHour; hour++) {
            hourPromises.push(this.generateHourlyLoop(
                targetDate,
                hour,
                retailerId,
                storeId,
                content,
                firstPositionOfHour(hour, startHour),
                fallback,
                reserved.get(hour) || new Map()
            ));
        }

        const generatedLoops = await Promise.all(hourPromises);
        loops.push(...generatedLoops);

        await dailyScheduleRepository.save(storeId, targetDate, {
            retailer_id: retailerId,
            is_closed: false,
            operating_hours: loops.map(loop => loop.hour),
            loop_ids: loops.map(loop => loop.id),
        });

        logger.info(`[LoopGeneration] Generated ${loops.length} loops for ${targetDate}`);
        return { loops, operatingHours };
    }

    /**
     * Generate a single hourly loop
     */
    async generateHourlyLoop(date, hour, retailerId, storeId, content, sequenceStart = 0, fallback = null, reserved = new Map()) {
        const loopId = `${date}_${hour}_${storeId}`;

        // Build 12 slots using priority algorithm
        const slots = this.buildSlots(content, { sequenceStart, fallback, reserved });

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
     * Build 12 slots. A Paid position plays its reserved Creative or Fallback
     * Content; Retailer and Internal positions share the eligible content.
     * @param {Array} content - Eligible Retailer and Internal content
     * @param {Map} reserved - This hour's playable Reservations, by position
     * @returns {Array} 12 slots
     */
    buildSlots(content, { sequenceStart = 0, fallback = null, reserved = new Map() } = {}) {
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
            const category = allocatedCategory(sequencePosition);
            const eligible = byCategory.get(category);
            const item = category === 'paid'
                ? reserved.get(position) || null
                : eligible.length > 0
                    ? eligible[categoryIndexes[category]++ % eligible.length]
                    : null;
            if (!item && !fallback) {
                throw new Error('An approved neutral fallback asset is required for unoccupied reserved positions');
            }

            return {
                position,
                allocation_sequence_position: sequencePosition,
                allocated_category: category,
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
     * Get the eligible Retailer and Internal Campaign and category-media content
     * for a Store and date. Paid Campaigns play only through Reservations.
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
                    && isApprovedPlaybackAsset(asset);
            }).map(campaign => {
                const asset = mediaById.get(campaign.media_id || campaign.asset_id);
                return {
                    ...campaign,
                    type: (campaign.type || campaign.category || asset?.category || 'paid').toLowerCase(),
                    asset_id: campaign.asset_id || campaign.media_id || asset?.id || null,
                    asset_name: campaign.asset_name || asset?.title || asset?.filename || null,
                    campaign_id: campaign.id,
                };
            }).filter(campaign => campaign.asset_id && campaign.type !== 'paid');

            const categoryMedia = media.filter(asset => {
                const category = asset.category?.toLowerCase();
                const correctOwner = category === 'retailer'
                    ? asset.owner_type === 'retailer' && asset.owner_id === retailerId
                    : category === 'internal' && asset.owner_type === 'platform';
                return isApprovedPlaybackAsset(asset) && correctOwner;
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

    /**
     * The held Reservations for a Store and date that can play, by hour then
     * position: the Campaign is approved and its Creative is approved. Any
     * other Reservation's Slot plays Fallback Content.
     * @returns {Promise<Map<number, Map<number, object>>>}
     */
    async getReservedCreatives(storeId, targetDate) {
        const reservations = await slotReservationRepository.findForStoreAndDate(storeId, targetDate);
        const byHour = new Map();
        await Promise.all(reservations.map(async reservation => {
            const campaign = await campaignRepository.findById(reservation.campaign_id);
            const asset = campaign && await mediaRepository.findById(campaign.media_id || campaign.asset_id);
            if (campaign?.status !== 'approved' || !isApprovedPlaybackAsset(asset)) return;

            if (!byHour.has(reservation.hour)) byHour.set(reservation.hour, new Map());
            byHour.get(reservation.hour).set(reservation.position, {
                type: 'paid',
                campaign_id: campaign.id,
                asset_id: asset.id,
                asset_name: asset.title || asset.filename || null,
            });
        }));
        return byHour;
    }

    async getApprovedFallbackAsset() {
        const assets = await mediaRepository.findAll({
            where: [['category', '==', 'fallback']]
        });
        return assets
            .filter(isApprovedFallbackAsset)
            .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
    }

    /**
     * Check if date is within campaign date range
     */
    isDateInRange(targetDate, startDate, endDate) {
        if (!startDate || !endDate) return true; // No date restrictions
        return targetDate >= startDate && targetDate <= endDate;
    }
}

export const loopGenerationService = new LoopGenerationService();
