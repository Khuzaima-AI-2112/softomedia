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
import { creativeRepository } from '../repositories/CreativeRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { daypartRepository } from '../repositories/DaypartRepository.js';
import { BusinessHoursService } from './BusinessHoursService.js';
import { isPromotionScheduledAt } from './Dayparts.js';
import { heldReservations } from './ReservationRelease.js';
import { isCampaignRunning } from '../constants/campaigns.js';
import logger from '../utils/logger.js';
import {
    isApprovedFallbackAsset,
    isApprovedPlaybackAsset,
} from './PlaybackEligibility.js';
import { allocatedCategory, firstPositionOfHour, SLOTS_PER_LOOP, wholeRuns } from './SlotInventory.js';

// Slot configuration
export const SLOT_CONFIG = {
    SLOTS_PER_LOOP,
    SLOT_DURATION_SECONDS: 5,
    LOOP_DURATION_SECONDS: 60
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
        const [content, reserved, fallback, dayparts] = await Promise.all([
            this.getAvailableContent(retailerId, storeId, targetDate),
            this.getReservedCreatives(storeId, targetDate),
            this.getApprovedFallbackAsset(),
            daypartRepository.get(),
        ]);

        // Generate loop for each business hour (PARALLELIZED)
        const hourPromises = [];
        for (let hour = startHour; hour < endHour; hour++) {
            // A Retailer promotion plays only in the hours it is scheduled for.
            const hourContent = content.filter(item => item.type !== 'retailer'
                || isPromotionScheduledAt(item.schedule, dayparts, targetDate, hour));
            hourPromises.push(this.generateHourlyLoop(targetDate, hour, retailerId, storeId, hourContent, {
                sequenceStart: firstPositionOfHour(hour, startHour),
                fallback,
                reserved: reserved.get(hour) || new Map(),
            }));
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
    async generateHourlyLoop(date, hour, retailerId, storeId, content, placement = {}) {
        const loopId = `${date}_${hour}_${storeId}`;
        const slots = this.buildSlots(content, placement);
        // A Reservation whose position is no longer Paid (say, after opening hours
        // changed) cannot play; say so rather than dropping it silently.
        for (const [position, reservation] of placement.reserved || []) {
            if (slots[position]?.allocated_category !== 'paid') {
                logger.warn('[LoopGeneration] Reservation is not on a Paid Slot', {
                    storeId, date, hour, position, campaignId: reservation.campaign_id,
                });
            }
        }

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
     * Build 12 slots. A Paid Slot plays its reserved Creative or Fallback
     * Content; Retailer and Internal Slots share the eligible content in turn.
     * The turn carries on from the day's earlier Slots of the same category, so
     * content outnumbering one hour's Slots still plays across the day.
     * @param {Array} content - Eligible Retailer and Internal content
     * @param {Map} reserved - This hour's Reservations with an approved Creative, by position
     * @returns {Array} 12 slots
     */
    buildSlots(content, { sequenceStart = 0, fallback = null, reserved = new Map() } = {}) {
        const byCategory = new Map(['retailer', 'internal'].map(category => [
            category,
            content.filter(item => item.type?.toLowerCase() === category),
        ]));
        const categoryIndexes = { retailer: 0, internal: 0 };
        for (let earlier = 0; earlier < sequenceStart; earlier++) {
            const category = allocatedCategory(earlier);
            if (category in categoryIndexes) categoryIndexes[category]++;
        }

        return Array.from({ length: SLOT_CONFIG.SLOTS_PER_LOOP }, (_, position) => {
            const sequencePosition = sequenceStart + position;
            const category = allocatedCategory(sequencePosition);
            const eligible = byCategory.get(category) || [];
            const item = category === 'paid'
                ? reserved.get(position) || null
                : eligible.length > 0
                    ? eligible[categoryIndexes[category]++ % eligible.length]
                    : null;
            if (!item && !fallback) {
                throw new Error('An approved neutral fallback asset is required for Slots without playable content');
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
     * Get the eligible Retailer promotions, Internal Campaigns and Internal
     * media for a Store and date. Paid Campaigns play only through
     * Reservations; Retailer Slots play only the Retailer's own promotions,
     * each carrying its schedule of hours.
     */
    async getAvailableContent(retailerId, storeId, targetDate) {
        try {
            // Nobody approves a Campaign; it plays from submission until it ends (ADR 0007).
            const campaigns = (await campaignRepository.findAll()).filter(isCampaignRunning);

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
            // An untyped Campaign is Paid, and Paid Campaigns play only through Reservations.
            }).filter(campaign => campaign.asset_id && campaign.type !== 'paid'
                // A promotion names its own Retailer; it never plays for every Retailer.
                && (campaign.type !== 'retailer' || this.namesRetailer(campaign, retailerId)));

            // Retailer media plays only through a scheduled promotion.
            const categoryMedia = media.filter(asset => isApprovedPlaybackAsset(asset)
                && asset.category?.toLowerCase() === 'internal'
                && asset.owner_type === 'platform'
            ).map(asset => ({
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
     * A Store's held Reservations for a date whose Creative is approved, by hour then
     * position. Any other Reservation's Slot gets Fallback Content. Nobody
     * approves the Campaign itself (ADR 0007); whether it still runs is checked
     * when the Slot plays. A Creative's files play in order across each run of
     * its consecutive Slots; a Slot outside a whole run gets Fallback Content
     * rather than a file out of order.
     * @returns {Promise<Map<number, Map<number, object>>>}
     */
    async getReservedCreatives(storeId, targetDate) {
        const store = await StoreRepository.findById(storeId);
        const reservations = store ? await heldReservations(store, targetDate) : [];
        const byCampaignHour = new Map();
        for (const reservation of reservations) {
            const key = `${reservation.campaign_id}_${reservation.hour}`;
            byCampaignHour.set(key, [...(byCampaignHour.get(key) || []), reservation]);
        }

        const byHour = new Map();
        await Promise.all([...byCampaignHour.values()].map(async held => {
            const { campaign_id: campaignId, hour } = held[0];
            const campaign = await campaignRepository.findById(campaignId);
            const files = campaign ? await this.getCreativeFiles(campaign, store.retailer_id) : [];
            if (files.length === 0) return;

            const positions = held.map(reservation => reservation.position);
            const runs = wholeRuns(positions, files.length);
            if (runs.flat().length < positions.length) {
                logger.warn('[LoopGeneration] Reservations do not form whole runs of the Creative', {
                    storeId, date: targetDate, hour, campaignId, positions,
                });
            }
            if (!byHour.has(hour)) byHour.set(hour, new Map());
            for (const run of runs) {
                run.forEach((position, index) => byHour.get(hour).set(position, {
                    type: 'paid',
                    campaign_id: campaign.id,
                    asset_id: files[index].id,
                    asset_name: files[index].title || files[index].filename || null,
                }));
            }
        }));
        return byHour;
    }

    /** The files of a Campaign's Creative in play order, or none unless every one may play in the Retailer's Stores. */
    async getCreativeFiles(campaign, retailerId) {
        const first = await mediaRepository.findById(campaign.media_id || campaign.asset_id);
        if (!first) return [];
        const { creative, mediaIds } = await creativeRepository.withFilesFor(first);
        const files = await Promise.all(mediaIds.map(id => (id === first.id ? first : mediaRepository.findById(id))));
        return files.every(file => isApprovedPlaybackAsset(file, creative, retailerId)) ? files : [];
    }

    namesRetailer(campaign, retailerId) {
        return campaign.retailer_id === retailerId
            || (campaign.inventory_selection || []).some(selection => selection.retailer_id === retailerId);
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
