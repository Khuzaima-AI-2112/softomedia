import { dailyScheduleRepository } from '../repositories/DailyScheduleRepository.js';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import { locationRepository } from '../repositories/LocationRepository.js';
import { loopRepository, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { mediaRepository } from '../repositories/MediaRepository.js';
import { screenRepository } from '../repositories/ScreenRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { deviceMediaPath } from '../constants/mediaPaths.js';
import {
    isApprovedFallbackAsset,
    isApprovedPlaybackAsset,
} from './PlaybackEligibility.js';

export class PlaybackError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'PlaybackError';
        this.status = status;
    }
}

export function storeLocalDateAndHour(now, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
        }).formatToParts(now)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value]),
    );

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour),
    };
}

export class PlaybackService {
    async getForScreen(screenId, now = new Date()) {
        const screen = await screenRepository.findById(screenId);
        if (!screen) throw new PlaybackError('Screen not found', 404);

        const [store, location] = await Promise.all([
            screen.store_id ? StoreRepository.findById(screen.store_id) : null,
            screen.location_id ? locationRepository.findById(screen.location_id) : null,
        ]);
        if (!store || !location) {
            throw new PlaybackError('Screen assignment is incomplete', 409);
        }

        const assignmentMatches = location.store_id === store.id
            && store.retailer_id === screen.retailer_id
            && location.retailer_id === screen.retailer_id;
        if (!assignmentMatches) {
            throw new PlaybackError('Screen assignment is invalid', 409);
        }

        const current = storeLocalDateAndHour(now, store.time_zone);
        const schedule = await dailyScheduleRepository.findByStoreAndDate(store.id, current.date);
        const loops = schedule?.retailer_id === store.retailer_id
            ? await Promise.all((schedule.loop_ids || []).map(loopId => loopRepository.findById(loopId)))
            : [];
        const loop = loops
            .filter(candidate => candidate
                && candidate.store_id === store.id
                && candidate.retailer_id === store.retailer_id
                && candidate.date === current.date
                && candidate.hour === current.hour
                && candidate.status === LOOP_STATUS.APPROVED)
            .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] || null;

        if (!loop) {
            return this.holdingSlide(screen, store, location, current);
        }

        const slots = await this.prepareSlots(loop.slots || [], {
            date: current.date,
            retailerId: store.retailer_id,
            storeId: store.id,
            locationId: location.id,
            screenId: screen.id,
        });
        if (!slots) {
            return this.holdingSlide(screen, store, location, current);
        }

        return {
            screen_id: screen.id,
            retailer_id: screen.retailer_id,
            store_id: store.id,
            location_id: location.id,
            broadcast_date: current.date,
            hour: current.hour,
            connectivity_status: screen.status,
            schedule_status: 'approved',
            playback_mode: 'approved_schedule',
            loop_id: loop.id,
            slots,
        };
    }

    async prepareSlots(slots, context) {
        const [assets, campaigns] = await Promise.all([
            mediaRepository.findAll(),
            campaignRepository.findAll(),
        ]);
        const assetsById = new Map(assets.map(asset => [asset.id, asset]));
        const campaignsById = new Map(campaigns.map(campaign => [campaign.id, campaign]));
        const approvedFallback = assets
            .filter(isApprovedFallbackAsset)
            .sort((a, b) => a.id.localeCompare(b.id))[0] || null;

        const resolved = slots.map(slot => this.resolveSlot(slot, {
            assetsById,
            campaignsById,
            approvedFallback,
            context,
        }));
        return resolved.some(slot => slot === null) ? null : resolved;
    }

    resolveSlot(slot, { assetsById, campaignsById, approvedFallback, context }) {
        const isFallback = slot.is_fallback || slot.content_kind === 'fallback';
        const isCampaign = !isFallback
            && slot.content_kind === 'campaign'
            && Boolean(slot.campaign_id);
        const storedAsset = assetsById.get(slot.asset_id);
        const isEligible = isFallback
            ? isApprovedFallbackAsset(storedAsset)
            : isCampaign
                ? this.isEligibleCampaignSlot(
                    slot,
                    campaignsById.get(slot.campaign_id),
                    storedAsset,
                    context,
                )
                : this.isEligibleMediaSlot(slot, storedAsset, context);
        const useFallback = !isEligible;
        if (useFallback && !approvedFallback) return null;

        const asset = useFallback ? approvedFallback : storedAsset;
        const presentationType = useFallback || isFallback
            ? 'fallback'
            : isCampaign ? 'campaign' : 'media';
        return {
            ...slot,
            ...(useFallback ? {
                campaign_id: null,
                content_kind: 'fallback',
                is_fallback: true,
                fallback_for_category: slot.allocated_category,
            } : isFallback ? {
                fallback_for_category: slot.allocated_category,
            } : {}),
            asset_id: asset.id,
            asset_name: asset.title || asset.filename || slot.asset_name || null,
            // Stored media is private; the Player reads it through its device media route.
            url: asset.storage_path ? deviceMediaPath(asset.id) : asset.url || asset.content_url || slot.url || null,
            presentation_type: presentationType,
            counts_as_delivery: presentationType === 'campaign',
        };
    }

    isEligibleCampaignSlot(slot, campaign, asset, {
        date,
        retailerId,
        storeId,
        locationId,
        screenId,
    }) {
        if (!campaign || campaign.status !== 'approved') return false;
        if (campaign.retailer_id && campaign.retailer_id !== retailerId) return false;
        if (campaign.start_date && date < campaign.start_date) return false;
        if (campaign.end_date && date > campaign.end_date) return false;
        if ((campaign.asset_id || campaign.media_id) !== slot.asset_id) return false;
        if (!isApprovedPlaybackAsset(asset)) return false;

        const campaignOwnerId = campaign.advertiser_id || campaign.brand_id;
        if (campaignOwnerId || asset.owner_type === 'brand') {
            if (!campaignOwnerId
                || asset.owner_type !== 'brand'
                || asset.owner_id !== campaignOwnerId) return false;
        }

        const selections = Array.isArray(campaign.inventory_selection)
            ? campaign.inventory_selection
            : [];
        if (selections.length > 0) {
            return selections.some(selection =>
                selection.retailer_id === retailerId
                && selection.store_id === storeId
                && (!selection.location_id || selection.location_id === locationId)
                && (!selection.screen_id || selection.screen_id === screenId)
            );
        }
        return campaign.retailer_id === retailerId
            && (campaign.store_id === storeId || campaign.store_id === 'ALL');
    }

    isEligibleMediaSlot(slot, asset, { retailerId }) {
        if (!isApprovedPlaybackAsset(asset)) return false;
        if (asset.category !== slot.allocated_category) return false;
        if (asset.category === 'retailer') {
            return asset.owner_type === 'retailer' && asset.owner_id === retailerId;
        }
        return asset.category === 'internal' && asset.owner_type === 'platform';
    }

    holdingSlide(screen, store, location, current) {
        return {
            screen_id: screen.id,
            retailer_id: screen.retailer_id,
            store_id: store.id,
            location_id: location.id,
            broadcast_date: current.date,
            hour: current.hour,
            connectivity_status: screen.status,
            schedule_status: 'No approved schedule',
            playback_mode: 'holding_slide',
            presentation_type: 'holding_slide',
            counts_as_delivery: false,
            loop_id: null,
            slots: [],
        };
    }
}

export const playbackService = new PlaybackService();
