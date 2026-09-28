import { describe, expect, test } from '@jest/globals';

const {
    DEMO_STORAGE_PREFIX,
    buildDemoBaseline,
} = await import('../src/services/DemoBaseline.js');
const { DEFAULT_DAYPARTS } = await import('../src/services/Dayparts.js');
const { allocatedCategory } = await import('../src/services/SlotInventory.js');

// 03:30 on 15 January in Phoenix, the all-day Store's time zone.
const RESET_AT = new Date('2030-01-15T10:30:00.000Z');
const ALL_DAY_STORE = 'demo-store-phoenix-allday';

function recordsByCollection(baseline, collection) {
    return baseline.documents.filter(document => document.collection === collection);
}

const dataOf = (baseline, collection) => recordsByCollection(baseline, collection).map(({ data }) => data);

/** The Paid positions of an hour at a Store that opens at `openingHour`. */
const paidPositions = (hour, openingHour) => Array.from({ length: 12 }, (_, position) => position)
    .filter(position => allocatedCategory((hour - openingHour) * 12 + position) === 'paid');
const firstPaidPosition = (hour, openingHour) => paidPositions(hour, openingHour)[0];

describe('deterministic SM_MVP1 demo baseline', () => {
    const baseline = buildDemoBaseline({ resetAt: RESET_AT, bucketName: 'softomedia-demo-assets' });

    test('builds the accepted organization, media, and relative-date fixture set', () => {
        const advertisers = recordsByCollection(baseline, 'advertisers');
        const retailers = recordsByCollection(baseline, 'retailers');
        const stores = recordsByCollection(baseline, 'stores');
        const locations = recordsByCollection(baseline, 'locations');
        const screens = recordsByCollection(baseline, 'screens');
        const media = recordsByCollection(baseline, 'media');
        const campaigns = recordsByCollection(baseline, 'campaigns');

        expect(retailers).toHaveLength(2);
        expect(stores.map(({ data }) => [data.id, data.time_zone])).toEqual([
            ['demo-store-mtl-north', 'America/Toronto'],
            ['demo-store-phoenix', 'America/Phoenix'],
            [ALL_DAY_STORE, 'America/Phoenix'],
        ]);
        expect(locations.filter(({ data }) => data.store_id === 'demo-store-mtl-north')).toHaveLength(2);
        expect(screens.filter(({ data }) => data.store_id === 'demo-store-mtl-north')).toHaveLength(2);
        expect(screens.filter(({ data }) => data.store_id === 'demo-store-phoenix')).toHaveLength(1);
        expect(screens.filter(({ data }) => data.store_id === ALL_DAY_STORE)).toHaveLength(1);

        expect(media.map(({ data }) => data.category)).toEqual([
            'paid',
            'retailer',
            'internal',
            'fallback',
        ]);
        expect(media.every(({ data }) => data.status === 'approved')).toBe(true);
        expect(media.map(({ data }) => data.storage_path)).toEqual(
            baseline.storageObjects.map(object => `gs://softomedia-demo-assets/${object.name}`)
        );
        expect(baseline.storageObjects.every(object => object.name.startsWith(DEMO_STORAGE_PREFIX))).toBe(true);

        // The demo's paid file belongs to an approved Creative of its Brand.
        const paid = media.find(({ data }) => data.category === 'paid').data;
        expect(dataOf(baseline, 'creatives')).toEqual([
            expect.objectContaining({
                id: paid.creative_id,
                brand_id: paid.owner_id,
                media_ids: [paid.id],
                approval_status: 'approved',
            }),
        ]);

        expect(campaigns).toHaveLength(2);
        expect(campaigns.every(({ data }) => data.advertiser_id === 'demo-advertiser-secondary')).toBe(true);
        expect(campaigns.map(({ data }) => [data.status, data.start_date, data.end_date])).toEqual([
            ['approved', '2030-01-15', '2030-01-28'],
            ['pending_approval', '2030-01-22', '2030-02-05'],
        ]);

        expect([...advertisers, ...retailers].every(({ data }) => !('deleted_at' in data))).toBe(true);
        expect(JSON.stringify(baseline)).not.toMatch(/password|token|secret|service.?account|demo_reset_scope/i);
        expect(buildDemoBaseline({ resetAt: RESET_AT, bucketName: 'softomedia-demo-assets' })).toEqual(baseline);
    });

    test('keeps the Store open every hour of every day, so its schedule plays whenever the demo runs', () => {
        const hours = dataOf(baseline, 'store_default_hours').filter(hours => hours.store_id === ALL_DAY_STORE);
        expect(hours.map(({ day_of_week: day, open_time: open, close_time: close, is_closed: closed }) =>
            [day, open, close, closed])).toEqual(
            Array.from({ length: 7 }, (_, day) => [day, '00:00', '00:00', false]));
    });

    test('seeds the network Dayparts', () => {
        expect(dataOf(baseline, 'platform_config')).toEqual([
            expect.objectContaining({ id: 'dayparts', ...DEFAULT_DAYPARTS }),
        ]);
    });

    test('reserves Slots for its sample Brand Campaigns', () => {
        const reservations = dataOf(baseline, 'slot_reservations');
        const forCampaign = campaignId => reservations.filter(reservation => reservation.campaign_id === campaignId);

        // The approved Campaign holds the first Paid Slot of every hour, today and tomorrow, at the all-day Store.
        const approved = forCampaign('demo-secondary-campaign-1');
        expect(approved.map(({ store_id: store, date, hour, position }) => [store, date, hour, position])).toEqual(
            ['2030-01-15', '2030-01-16'].flatMap(date => Array.from({ length: 24 }, (_, hour) =>
                [ALL_DAY_STORE, date, hour, firstPaidPosition(hour, 0)])));

        // The pending Campaign holds two Paid Slots at lunch on its first day in Phoenix.
        const pending = forCampaign('demo-secondary-campaign-2');
        expect(pending.map(({ store_id: store, date, hour, position }) => [store, date, hour, position])).toEqual(
            paidPositions(12, 8).slice(0, 2).map(position => ['demo-store-phoenix', '2030-01-22', 12, position]));

        expect(reservations).toHaveLength(approved.length + pending.length);
        for (const reservation of reservations) {
            expect(reservation).toEqual(expect.objectContaining({
                id: `${reservation.store_id}_${reservation.date}_${reservation.hour}_${reservation.position}`,
                brand_id: 'demo-advertiser-secondary',
                status: 'held',
                price: expect.any(Number),
            }));
            expect(reservation.price).toBeGreaterThan(0);
        }

        // Each Campaign books the Stores it holds Slots in.
        const campaigns = dataOf(baseline, 'campaigns');
        for (const campaign of campaigns) {
            const booked = new Set(campaign.inventory_selection.map(selection => selection.store_id));
            expect(forCampaign(campaign.id).every(reservation => booked.has(reservation.store_id))).toBe(true);
        }
    });

    test('approves today\'s schedule for the all-day Store, playing the reserved Creative in its Slots', () => {
        const loops = dataOf(baseline, 'loops').filter(loop => loop.store_id === ALL_DAY_STORE);
        expect(loops.map(loop => [loop.id, loop.date, loop.hour, loop.status])).toEqual(
            Array.from({ length: 24 }, (_, hour) =>
                [`2030-01-15_${hour}_${ALL_DAY_STORE}`, '2030-01-15', hour, 'approved']));

        for (const loop of loops) {
            expect(loop.retailer_id).toBe('demo-retailer-secondary');
            expect(loop.slots).toHaveLength(12);
            const reserved = firstPaidPosition(loop.hour, 0);
            loop.slots.forEach((slot, position) => {
                expect(slot.allocated_category).toBe(allocatedCategory(loop.hour * 12 + position));
                const expected = position === reserved
                    ? { asset_id: 'demo-media-paid', campaign_id: 'demo-secondary-campaign-1', content_kind: 'campaign' }
                    : slot.allocated_category === 'internal'
                        ? { asset_id: 'demo-media-internal', campaign_id: null, content_kind: 'media' }
                        : { asset_id: 'demo-media-fallback', campaign_id: null, content_kind: 'fallback' };
                expect(slot).toEqual(expect.objectContaining(expected));
            });
        }

        expect(dataOf(baseline, 'daily_schedules')).toEqual([expect.objectContaining({
            id: `${ALL_DAY_STORE}_2030-01-15`,
            store_id: ALL_DAY_STORE,
            retailer_id: 'demo-retailer-secondary',
            date: '2030-01-15',
            is_closed: false,
            operating_hours: loops.map(loop => loop.hour),
            loop_ids: loops.map(loop => loop.id),
        })]);
    });

    test('dates today\'s schedule by the Store\'s own calendar, not UTC', () => {
        // 02:00 UTC on the 16th is still the evening of the 15th in Phoenix.
        const evening = buildDemoBaseline({
            resetAt: new Date('2030-01-16T02:00:00.000Z'),
            bucketName: 'softomedia-demo-assets',
        });
        expect(new Set(dataOf(evening, 'loops')
            .filter(loop => loop.store_id === ALL_DAY_STORE)
            .map(loop => loop.date))).toEqual(new Set(['2030-01-15']));
    });
});
