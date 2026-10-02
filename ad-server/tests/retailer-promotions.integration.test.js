import { jest, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const {
    campaignRepository,
    mediaRepository,
    retailerRepository,
    StoreRepository,
} = await import('../src/repositories/index.js');
const { default: BusinessHoursRepository } = await import('../src/repositories/BusinessHoursRepository.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');
const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

// Monday 2030-01-07. The café opens 08:00–14:00, so breakfast (06–11) is
// trimmed to the 08:00, 09:00 and 10:00 loops.
const DATE = '2030-01-07';
const NEXT_DATE = '2030-01-08';
const MONDAY = 1;
const TUESDAY = 2;

const approvedMedia = fields => ({ approval_status: 'approved', eligible_for_playback: true, status: 'ready', ...fields });

async function seedRetailer(retailerId, storeId) {
    await retailerRepository.create(retailerId, { name: `${retailerId} Cafés`, status: 'active' });
    await StoreRepository.create(storeId, {
        name: `${retailerId} Downtown`, retailer_id: retailerId, status: 'active', time_zone: 'America/Toronto',
    });
    for (const day of [MONDAY, TUESDAY]) {
        await BusinessHoursRepository.create(`def_${storeId}_${day}`, {
            store_id: storeId, day_of_week: day, is_closed: false, open_time: '08:00', close_time: '14:00',
        });
    }
}

async function seed() {
    await seedRetailer('retailer-one', 'store-one');
    await seedRetailer('retailer-two', 'store-two');
    await mediaRepository.create('fallback-media', approvedMedia({
        title: 'Neutral fallback', category: 'fallback', content_kind: 'neutral_fallback',
        owner_type: 'platform', owner_id: null,
    }));
    await mediaRepository.create('internal-media', approvedMedia({
        title: 'Softomedia house ad', category: 'internal', owner_type: 'platform', owner_id: null,
    }));
    for (const [id, title] of [['muffin-media', 'Muffin with any coffee'], ['bagel-media', 'Bagel upsell'], ['soup-media', 'Soup of the day']]) {
        await mediaRepository.create(id, approvedMedia({
            title, category: 'retailer', owner_type: 'retailer', owner_id: 'retailer-one',
        }));
    }
    await mediaRepository.create('other-retailer-media', approvedMedia({
        title: 'Retailer Two promotion', category: 'retailer', owner_type: 'retailer', owner_id: 'retailer-two',
    }));
}

const headersFor = async (role, organizationId = null) => (await signInAs(role, { organizationId })).headers;

const promotion = (fields = {}) => ({
    type: 'retailer',
    name: 'Breakfast muffin upsell',
    retailer_id: 'retailer-one',
    media_id: 'muffin-media',
    schedule: { dates: [DATE], dayparts: ['breakfast'], hours: [] },
    ...fields,
});

async function schedule(fields) {
    const created = await request(app).post('/api/campaigns').set(await headersFor('admin')).send(promotion(fields));
    expect({ status: created.status, error: created.body.error }).toEqual({ status: 201, error: undefined });
    return created.body;
}

async function generate(date = DATE, retailerId = 'retailer-one', storeId = 'store-one') {
    const generated = await request(app).post('/api/loops/generate').set(await headersFor('admin'))
        .send({ targetDate: date, retailerId, storeId });
    expect({ status: generated.status, error: generated.body.error }).toEqual({ status: 201, error: undefined });
    return Object.fromEntries(generated.body.loops.map(loop => [loop.hour, loop.slots]));
}

const retailerSlots = slots => slots.filter(slot => slot.allocated_category === 'retailer');
const assetsIn = slots => slots.map(slot => slot.asset_id);

describeWithAuthEmulator('Retailer promotions by time of day', () => {
    beforeEach(async () => {
        clearMockStorage();
        await seed();
    });

    test('an Admin schedules a Retailer promotion for chosen dates and Dayparts', async () => {
        const created = await request(app).post('/api/campaigns').set(await headersFor('admin'))
            .send(promotion({ schedule: { dates: [NEXT_DATE, DATE, DATE], dayparts: ['breakfast'], hours: [13] } }));

        expect(created.status).toBe(201);
        expect(await campaignRepository.findById(created.body.id)).toMatchObject({
            type: 'retailer',
            retailer_id: 'retailer-one',
            media_id: 'muffin-media',
            schedule: { dates: [DATE, NEXT_DATE], dayparts: ['breakfast'], hours: [13] },
            start_date: DATE,
            end_date: NEXT_DATE,
            status: 'scheduled',
        });
    });

    test('a Retailer Administrator still can\'t create a promotion, even for its own Retailer', async () => {
        const denied = await request(app).post('/api/campaigns')
            .set(await headersFor('retaileradmin', 'retailer-one')).send(promotion());

        expect(denied.status).toBe(403);
        expect(await campaignRepository.findAll()).toEqual([]);
    });

    test.each([
        ['without a schedule', { schedule: undefined }, 'A promotion needs a schedule of dates and hours or Dayparts'],
        ['without hours or Dayparts', { schedule: { dates: [DATE], dayparts: [], hours: [] } }, 'Choose at least one hour or Daypart'],
        ['with another Retailer\'s media', { media_id: 'other-retailer-media' }, 'The promotion\'s media must be this Retailer\'s own'],
        ['for another Retailer\'s Store', { store_id: 'store-two' }, 'The Store must belong to this Retailer'],
        ['for an unknown Retailer', { retailer_id: 'retailer-missing' }, 'The Retailer is unavailable'],
    ])('a promotion %s is refused', async (_name, fields, error) => {
        const refused = await request(app).post('/api/campaigns').set(await headersFor('admin')).send(promotion(fields));

        expect({ status: refused.status, error: refused.body.error }).toEqual({ status: 400, error });
        expect(await campaignRepository.findAll()).toEqual([]);
    });

    test('a breakfast promotion plays only in breakfast hours, trimmed to the Store\'s hours, and only in Retailer Slots', async () => {
        const muffin = await schedule();

        const loops = await generate();

        expect(Object.keys(loops).map(Number)).toEqual([8, 9, 10, 11, 12, 13]);
        for (const hour of [8, 9, 10]) {
            expect(retailerSlots(loops[hour]).length).toBeGreaterThan(0);
            expect(retailerSlots(loops[hour])).toEqual(retailerSlots(loops[hour]).map(() => expect.objectContaining({
                asset_id: 'muffin-media', campaign_id: muffin.id, is_fallback: false,
            })));
        }
        for (const hour of [11, 12, 13]) {
            expect(assetsIn(retailerSlots(loops[hour])).every(asset => asset === 'fallback-media')).toBe(true);
        }
        const everySlot = Object.values(loops).flat();
        expect(everySlot.filter(slot => slot.asset_id === 'muffin-media')
            .every(slot => slot.allocated_category === 'retailer')).toBe(true);
    });

    test('a promotion plays only on its scheduled dates', async () => {
        await schedule();

        const nextDay = await generate(NEXT_DATE);

        expect(Object.values(nextDay).flat().some(slot => slot.asset_id === 'muffin-media')).toBe(false);
    });

    test('a promotion plays only in its own Retailer\'s Stores', async () => {
        await schedule();

        const otherRetailer = await generate(DATE, 'retailer-two', 'store-two');

        expect(Object.values(otherRetailer).flat().some(slot => slot.asset_id === 'muffin-media')).toBe(false);
    });

    test('promotions scheduled for the same hour share the Retailer Slots in turn', async () => {
        await schedule();
        await schedule({ name: 'Bagel upsell', media_id: 'bagel-media' });
        await schedule({ name: 'Soup at noon', media_id: 'soup-media', schedule: { dates: [DATE], hours: [12] } });

        const loops = await generate();

        const breakfastPlays = [8, 9, 10].flatMap(hour => assetsIn(retailerSlots(loops[hour])));
        expect(new Set(breakfastPlays)).toEqual(new Set(['muffin-media', 'bagel-media']));
        expect(breakfastPlays.filter(asset => asset === 'muffin-media').length)
            .toBeGreaterThanOrEqual(Math.floor(breakfastPlays.length / 2));
        expect(breakfastPlays.filter(asset => asset === 'bagel-media').length)
            .toBeGreaterThanOrEqual(Math.floor(breakfastPlays.length / 2));
        expect(new Set(assetsIn(retailerSlots(loops[12])))).toEqual(new Set(['soup-media']));
        expect(new Set(assetsIn(retailerSlots(loops[11])))).toEqual(new Set(['fallback-media']));
    });

    test('the turn carries across the day, so more promotions than an hour has Retailer Slots all play', async () => {
        // An hour has two or three Retailer Slots; breakfast here has seven in all.
        const names = ['muffin-media', 'bagel-media', 'soup-media', 'scone-media'];
        await mediaRepository.create('scone-media', approvedMedia({
            title: 'Scone upsell', category: 'retailer', owner_type: 'retailer', owner_id: 'retailer-one',
        }));
        for (const mediaId of names) await schedule({ name: mediaId, media_id: mediaId });

        const loops = await generate();

        const breakfastPlays = [8, 9, 10].flatMap(hour => assetsIn(retailerSlots(loops[hour])));
        const plays = names.map(name => breakfastPlays.filter(asset => asset === name).length);
        expect(Math.min(...plays)).toBeGreaterThan(0);
        expect(Math.max(...plays) - Math.min(...plays)).toBeLessThanOrEqual(1);
    });

    test('a promotion follows the Dayparts the Super Administrator sets later', async () => {
        await schedule();
        const saved = await request(app).put('/api/dayparts').set(await headersFor('superadmin')).send({
            breakfast: { start: 11, end: 13 }, lunch: { start: 13, end: 15 }, dinner: { start: 17, end: 21 },
        });
        expect(saved.status).toBe(200);

        const loops = await generate();

        expect(new Set(assetsIn(retailerSlots(loops[8])))).toEqual(new Set(['fallback-media']));
        expect(new Set(assetsIn(retailerSlots(loops[11])))).toEqual(new Set(['muffin-media']));
    });

    test('a cancelled promotion doesn\'t play', async () => {
        const created = await schedule();
        expect((await request(app).post(`/api/campaigns/${created.id}/cancel`).set(await headersFor('admin'))).status)
            .toBe(200);

        const loops = await generate();

        expect(Object.values(loops).flat().some(slot => slot.asset_id === 'muffin-media')).toBe(false);
    });

    test('Retailer media that isn\'t in a promotion doesn\'t fill Retailer Slots', async () => {
        const loops = await generate();

        expect(new Set(Object.values(loops).flatMap(slots => assetsIn(retailerSlots(slots)))))
            .toEqual(new Set(['fallback-media']));
    });
});
