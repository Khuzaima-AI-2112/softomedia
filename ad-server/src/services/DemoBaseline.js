import { CREATIVE_STATUS } from '../constants/creatives.js';
import { DEFAULT_PRICING } from '../repositories/PricingRepository.js';
import { LOOP_STATUS } from '../repositories/LoopRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import { slotQuote } from './CampaignPricingService.js';
import { DEFAULT_DAYPARTS } from './Dayparts.js';
import { loopGenerationService } from './LoopGenerationService.js';
import { firstPositionOfHour, paidPositions } from './SlotInventory.js';
import { storeLocalNow } from './SlotReservations.js';

export const DEMO_STORAGE_PREFIX = 'phase-1-demo/';

/**
 * Every collection the app keeps business records in. The demo project holds
 * nothing else, so demo reset empties all of them, whoever wrote the records.
 * User profiles are kept, with the demo's Firebase accounts.
 */
export const DEMO_BUSINESS_COLLECTIONS = Object.freeze([
    'ads',
    'advertisers',
    'campaigns',
    'creatives',
    'daily_schedules',
    'demo_organizations',
    'impressions',
    'invoices',
    'locations',
    'loops',
    'media',
    'notifications',
    'playlists',
    'playback_observations',
    'platform_config',
    'pricing_config',
    'platform_audits',
    'proof_of_play',
    'retailers',
    'schedule_overrides',
    'scheduling_audits',
    'screens',
    'slot_reservations',
    'store_default_hours',
    'store_special_hours',
    'stores',
    'support_tickets',
    'tickets',
]);

const SYNTHETIC_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);

/** The calendar date `days` after a YYYY-MM-DD date. */
function calendarDateAfter(date, days) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
}

function record(collection, id, data, resetAtIso) {
    return {
        collection,
        id,
        data: {
            id,
            ...data,
            created_at: resetAtIso,
            updated_at: resetAtIso,
        },
    };
}

function mediaFixture({ id, category, ownerType, ownerId, creativeId, bucketName, resetAtIso }) {
    const objectName = `${DEMO_STORAGE_PREFIX}media/${category}.png`;
    return {
        document: record('media', id, {
            filename: `${category}-synthetic-demo.png`,
            title: `Synthetic Demo ${category[0].toUpperCase()}${category.slice(1)} Media`,
            category,
            content_kind: category === 'fallback' ? 'neutral_fallback' : 'campaign',
            duration: 5,
            file_type: 'image/png',
            owner_type: ownerType,
            owner_id: ownerId,
            ...(creativeId ? { creative_id: creativeId } : {}),
            status: 'approved',
            is_fallback: category === 'fallback',
            storage_path: `gs://${bucketName}/${objectName}`,
        }, resetAtIso),
        storageObject: {
            name: objectName,
            body: SYNTHETIC_PNG,
            metadata: {
                contentType: 'image/png',
                cacheControl: 'private, max-age=300',
                metadata: {
                    mediaCategory: category,
                },
            },
        },
    };
}

/** A Brand Campaign's held Slot Reservations, each priced as the Brand would have booked it. */
function reservationRecords({ campaign, store, slots, resetAtIso }) {
    return slots.map(({ date, hour, position }) => {
        const slot = { store_id: store.id, date, hour, position };
        const { price } = slotQuote({
            config: DEFAULT_PRICING,
            retailerId: store.retailer_id,
            storeTier: store.cpm_traffic_tier,
            date,
            hour,
        });
        return record('slot_reservations', slotReservationRepository.idFor(slot), {
            ...slot,
            brand_id: campaign.advertiser_id,
            campaign_id: campaign.id,
            status: 'held',
            price,
        }, resetAtIso);
    });
}

/**
 * A Store's Daily Schedule, already approved by its Retailer: the Hourly Loops
 * that loop generation would make for these Slot Reservations and content.
 */
function approvedDailySchedule({ store, date, hours, reserved, content, fallback, resetAtIso }) {
    const loops = hours.map(hour => record('loops', `${date}_${hour}_${store.id}`, {
        date,
        hour,
        retailer_id: store.retailer_id,
        store_id: store.id,
        status: LOOP_STATUS.APPROVED,
        version: 1,
        generated_at: resetAtIso,
        approved_at: resetAtIso,
        approved_by: null,
        slots: loopGenerationService.buildSlots(content, {
            sequenceStart: firstPositionOfHour(hour, hours[0]),
            fallback,
            reserved: reserved.get(hour) || new Map(),
        }),
    }, resetAtIso));
    const dailySchedule = record('daily_schedules', `${store.id}_${date}`, {
        store_id: store.id,
        retailer_id: store.retailer_id,
        date,
        is_closed: false,
        operating_hours: hours,
        loop_ids: loops.map(loop => loop.id),
    }, resetAtIso);
    return [...loops, dailySchedule];
}

export function buildDemoBaseline({ resetAt = new Date(), bucketName }) {
    if (!(resetAt instanceof Date) || Number.isNaN(resetAt.getTime())) {
        throw new Error('resetAt must be a valid Date');
    }
    if (!bucketName) {
        throw new Error('A demo assets bucket name is required');
    }

    const resetAtIso = resetAt.toISOString();
    const resetDate = resetAtIso.slice(0, 10);
    const mediaFixtures = [
        mediaFixture({ id: 'demo-media-paid', category: 'paid', ownerType: 'brand', ownerId: 'demo-advertiser-secondary', creativeId: 'demo-creative-paid', bucketName, resetAtIso }),
        mediaFixture({ id: 'demo-media-retailer', category: 'retailer', ownerType: 'retailer', ownerId: 'demo-retailer-freshmart', bucketName, resetAtIso }),
        mediaFixture({ id: 'demo-media-internal', category: 'internal', ownerType: 'platform', ownerId: null, bucketName, resetAtIso }),
        mediaFixture({ id: 'demo-media-fallback', category: 'fallback', ownerType: 'platform', ownerId: null, bucketName, resetAtIso }),
    ];
    const [paidMedia, , internalMedia, fallbackMedia] = mediaFixtures.map(fixture => fixture.document.data);

    const northStore = record('stores', 'demo-store-mtl-north', {
        name: 'FreshMart North Synthetic Store',
        retailer_id: 'demo-retailer-freshmart',
        city: 'Montréal',
        country: 'CA',
        address: '100 Demo Way',
        time_zone: 'America/Toronto',
        location_ids: ['demo-location-mtl-entrance', 'demo-location-mtl-checkout'],
        status: 'active',
    }, resetAtIso);
    const phoenixStore = record('stores', 'demo-store-phoenix', {
        name: 'HarborCart Desert Synthetic Store',
        retailer_id: 'demo-retailer-secondary',
        city: 'Phoenix',
        country: 'US',
        address: '200 Example Avenue',
        time_zone: 'America/Phoenix',
        location_ids: ['demo-location-phoenix-entrance'],
        status: 'active',
    }, resetAtIso);
    // Open around the clock, so its schedule for today plays whenever the demo runs.
    const allDayStore = record('stores', 'demo-store-phoenix-allday', {
        name: 'HarborCart All-Day Synthetic Store',
        retailer_id: 'demo-retailer-secondary',
        city: 'Phoenix',
        country: 'US',
        address: '300 Example Avenue',
        time_zone: 'America/Phoenix',
        location_ids: ['demo-location-phoenix-allday-entrance'],
        status: 'active',
    }, resetAtIso);

    // "Today" is the all-day Store's own date, which is the date its Screen plays.
    const today = storeLocalNow(resetAt, allDayStore.data.time_zone).date;
    const allDayHours = Array.from({ length: 24 }, (_, hour) => hour);

    const currentCampaign = record('campaigns', 'demo-secondary-campaign-1', {
        name: 'Northstar Pantry Synthetic Campaign',
        advertiser_id: 'demo-advertiser-secondary',
        retailer_id: 'demo-retailer-secondary',
        media_id: paidMedia.id,
        inventory_selection: [phoenixStore, allDayStore].map(store => ({
            retailer_id: store.data.retailer_id,
            store_id: store.id,
        })),
        status: 'scheduled',
        visibility: 'private',
        start_date: today,
        end_date: calendarDateAfter(today, 13),
        budget: 2400,
    }, resetAtIso);
    const upcomingCampaign = record('campaigns', 'demo-secondary-campaign-2', {
        name: 'Northstar Home Synthetic Campaign',
        advertiser_id: 'demo-advertiser-secondary',
        retailer_id: 'demo-retailer-secondary',
        media_id: paidMedia.id,
        inventory_selection: [{ retailer_id: phoenixStore.data.retailer_id, store_id: phoenixStore.id }],
        status: 'scheduled',
        visibility: 'private',
        start_date: calendarDateAfter(resetDate, 7),
        end_date: calendarDateAfter(resetDate, 21),
        budget: 1800,
    }, resetAtIso);

    // Nobody approves a Campaign; their Creative has both approvals (ADR 0007).
    // The current Campaign holds the first Paid Slot of every hour at the
    // all-day Store, today and tomorrow; the upcoming one two Slots at lunch.
    const currentReservations = reservationRecords({
        campaign: currentCampaign.data,
        store: allDayStore.data,
        slots: [today, calendarDateAfter(today, 1)].flatMap(date => allDayHours.map(hour => ({
            date, hour, position: paidPositions(hour, 0)[0],
        }))),
        resetAtIso,
    });
    const upcomingReservations = reservationRecords({
        campaign: upcomingCampaign.data,
        store: phoenixStore.data,
        slots: paidPositions(12, 8).slice(0, 2).map(position => ({
            date: upcomingCampaign.data.start_date, hour: 12, position,
        })),
        resetAtIso,
    });

    const todaysReservedCreative = new Map(currentReservations
        .filter(({ data }) => data.date === today)
        .map(({ data }) => [data.hour, new Map([[data.position, {
            type: 'paid',
            campaign_id: currentCampaign.id,
            asset_id: paidMedia.id,
            asset_name: paidMedia.title,
        }]])]));
    const todaysSchedule = approvedDailySchedule({
        store: allDayStore.data,
        date: today,
        hours: allDayHours,
        reserved: todaysReservedCreative,
        content: [{
            type: 'internal',
            asset_id: internalMedia.id,
            asset_name: internalMedia.title,
            campaign_id: null,
            content_kind: 'media',
        }],
        fallback: fallbackMedia,
        resetAtIso,
    });

    const documents = [
        record('advertisers', 'demo-advertiser-bonvie', {
            name: 'BonVie Synthetic Brand',
            industry: 'Synthetic Packaged Goods',
            contactemail: 'brand@demo.softomedia.test',
            budget: 10000,
            status: 'active',
        }, resetAtIso),
        record('advertisers', 'demo-advertiser-secondary', {
            name: 'Northstar Synthetic Brand',
            industry: 'Synthetic Household Goods',
            contactemail: 'brand-secondary@demo.softomedia.test',
            budget: 8000,
            status: 'active',
        }, resetAtIso),
        record('retailers', 'demo-retailer-freshmart', {
            name: 'FreshMart Synthetic Retailer',
            contact_email: 'retaileradmin@demo.softomedia.test',
            contract_start: calendarDateAfter(resetDate, -30),
            status: 'active',
        }, resetAtIso),
        record('retailers', 'demo-retailer-secondary', {
            name: 'HarborCart Synthetic Retailer',
            contact_email: 'retaileradmin-secondary@demo.softomedia.test',
            contract_start: calendarDateAfter(resetDate, -30),
            status: 'active',
        }, resetAtIso),
        northStore,
        phoenixStore,
        allDayStore,
        // Standard hours every day, as a Store created through the API receives;
        // without them a Store is closed and no loops are generated for it.
        // A close of 00:00 is midnight at the end of the day.
        ...[
            { store: northStore, openTime: '08:00', closeTime: '22:00' },
            { store: phoenixStore, openTime: '08:00', closeTime: '22:00' },
            { store: allDayStore, openTime: '00:00', closeTime: '00:00' },
        ].flatMap(({ store, openTime, closeTime }) => Array.from({ length: 7 }, (_, dayOfWeek) =>
            record('store_default_hours', `def_${store.id}_${dayOfWeek}`, {
                store_id: store.id,
                day_of_week: dayOfWeek,
                open_time: openTime,
                close_time: closeTime,
                is_closed: false,
            }, resetAtIso))),
        record('locations', 'demo-location-mtl-entrance', {
            name: 'Entrance Placement',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            screen_ids: ['demo-screen-north-1'],
        }, resetAtIso),
        record('locations', 'demo-location-mtl-checkout', {
            name: 'Checkout Placement',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            screen_ids: ['demo-screen-north-2'],
        }, resetAtIso),
        record('locations', 'demo-location-phoenix-entrance', {
            name: 'Entrance Placement',
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            screen_ids: ['demo-screen-secondary-1'],
        }, resetAtIso),
        record('locations', 'demo-location-phoenix-allday-entrance', {
            name: 'Entrance Placement',
            retailer_id: 'demo-retailer-secondary',
            store_id: allDayStore.id,
            screen_ids: ['demo-screen-secondary-2'],
        }, resetAtIso),
        record('screens', 'demo-screen-north-1', {
            name: 'North Entrance Synthetic Screen',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-entrance',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        record('screens', 'demo-screen-north-2', {
            name: 'North Checkout Synthetic Screen',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-checkout',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        record('screens', 'demo-screen-secondary-1', {
            name: 'Desert Entrance Synthetic Screen',
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            location_id: 'demo-location-phoenix-entrance',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        record('screens', 'demo-screen-secondary-2', {
            name: 'All-Day Entrance Synthetic Screen',
            retailer_id: 'demo-retailer-secondary',
            store_id: allDayStore.id,
            location_id: 'demo-location-phoenix-allday-entrance',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        ...mediaFixtures.map(fixture => fixture.document),
        record('creatives', 'demo-creative-paid', {
            brand_id: 'demo-advertiser-secondary',
            title: 'Synthetic Demo Paid Media',
            media_ids: ['demo-media-paid'],
            approval_status: CREATIVE_STATUS.APPROVED,
            decided_by: null,
            decided_at: resetAtIso,
            reason: null,
            // Approved by the Super Administrator and by the Retailer it is booked with (ADR 0007).
            retailer_approvals: {
                [phoenixStore.data.retailer_id]: {
                    status: CREATIVE_STATUS.APPROVED, decided_by: null, decided_at: resetAtIso, reason: null,
                },
            },
        }, resetAtIso),
        currentCampaign,
        upcomingCampaign,
        ...currentReservations,
        ...upcomingReservations,
        record('platform_config', 'dayparts', { ...DEFAULT_DAYPARTS }, resetAtIso),
        record('loops', 'demo-loop-mtl-next-day-08', {
            date: calendarDateAfter(resetDate, 1),
            hour: 8,
            retailer_id: 'demo-retailer-freshmart',
            location_id: 'demo-location-mtl-entrance',
            screen_id: 'demo-screen-north-1',
            screen_ids: ['demo-screen-north-1'],
            status: 'pending_approval',
            version: 1,
            generated_at: resetAtIso,
            slots: Array.from({ length: 12 }, (_, position) => ({
                position,
                asset_id: mediaFixtures[position % mediaFixtures.length].document.id,
                asset_name: mediaFixtures[position % mediaFixtures.length].document.data.title,
                status: 'approved',
            })),
        }, resetAtIso),
        ...todaysSchedule,
    ];

    return {
        resetAt: resetAtIso,
        documents,
        storageObjects: mediaFixtures.map(fixture => fixture.storageObject),
    };
}
