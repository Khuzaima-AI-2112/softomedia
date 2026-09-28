import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { retailerRepository, StoreRepository } = await import('../src/repositories/index.js');
const { default: BusinessHoursRepository } = await import('../src/repositories/BusinessHoursRepository.js');
const { default: SpecialHoursRepository } = await import('../src/repositories/SpecialHoursRepository.js');
const { slotReservationRepository } = await import('../src/repositories/SlotReservationRepository.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');

const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

// 2030-01-07 is a Monday, a week after the suite's clock.
const DATE = '2030-01-07';
const MONDAY = 1;

const mondayHours = (open_time, close_time) => [{ day_of_week: MONDAY, is_closed: false, open_time, close_time }];

async function seedStore() {
    await retailerRepository.create('retailer-one', { name: 'Northwind Cafés', status: 'active' });
    await StoreRepository.create('store-one', {
        name: 'Northwind Downtown', retailer_id: 'retailer-one', status: 'active', time_zone: 'America/Toronto',
    });
    await BusinessHoursRepository.create(`def_store-one_${MONDAY}`, {
        store_id: 'store-one', day_of_week: MONDAY, is_closed: false, open_time: '08:00', close_time: '22:00',
    });
}

/** Holds a Slot for a Campaign, as submitting the Campaign would. */
async function reserve(hour, position, overrides = {}) {
    const reservation = {
        store_id: 'store-one', date: DATE, hour, position,
        campaign_id: 'campaign-one', brand_id: 'brand-one', status: 'held', price: 1,
        ...overrides,
    };
    await slotReservationRepository.create(slotReservationRepository.idFor(reservation), reservation);
}

describeWithAuthEmulator('Store-hours changes that would drop Reservations', () => {
    let admin;

    const saveWeeklyHours = weekly_hours => request(app)
        .put('/api/stores/store-one/weekly-hours').set(admin).send({ weekly_hours });

    const mondayCloseTime = async () => (await BusinessHoursRepository.getDefaultHours('store-one'))
        .find(day => day.day_of_week === MONDAY).close_time;

    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({
            now: new Date('2030-01-01T12:00:00.000Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
        });
        ({ headers: admin } = await signInAs('admin', { fakeClock: true }));
        await seedStore();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('weekly hours', () => {
        test('closing before a reserved hour is refused with the Reservation listed', async () => {
            await reserve(21, 0);

            const response = await saveWeeklyHours(mondayHours('08:00', '20:00'));

            expect(response.status).toBe(409);
            expect(response.body.code).toBe('HOURS_HOLD_RESERVATIONS');
            expect(response.body.reservations).toEqual([
                { store_id: 'store-one', date: DATE, hour: 21, position: 0, campaign_id: 'campaign-one' },
            ]);
            expect(await mondayCloseTime()).toBe('22:00');
        });

        test('a change that touches no Reservation is saved', async () => {
            await reserve(20, 0);

            const response = await saveWeeklyHours(mondayHours('08:00', '21:00'));

            expect(response.status).toBe(200);
            expect(await mondayCloseTime()).toBe('21:00');
        });

        test('opening after a reserved hour is refused', async () => {
            await reserve(8, 0);

            const response = await saveWeeklyHours(mondayHours('09:00', '22:00'));

            expect(response.status).toBe(409);
            expect(response.body.reservations.map(({ hour }) => hour)).toEqual([8]);
        });

        test('opening at another time is refused when it moves a reserved Slot off Paid', async () => {
            // Opening at 08:00, hour 10 starts at day position 24, a Paid Slot;
            // opening at 09:00 it starts at 12, a Retailer Slot.
            await reserve(10, 0);

            const response = await saveWeeklyHours(mondayHours('09:00', '22:00'));

            expect(response.status).toBe(409);
            expect(response.body.reservations).toEqual([
                { store_id: 'store-one', date: DATE, hour: 10, position: 0, campaign_id: 'campaign-one' },
            ]);
        });

        test('opening at another time is saved when every reserved Slot stays Paid', async () => {
            // Opening at 07:00, hour 10 starts at day position 36, still a Paid Slot.
            await reserve(10, 0);

            const response = await saveWeeklyHours(mondayHours('07:00', '22:00'));

            expect(response.status).toBe(200);
        });

        test('a date with Special Hours keeps them, so its Reservations are not affected', async () => {
            await SpecialHoursRepository.updateSpecialHours('store-one', DATE, {
                is_closed: false, open_time: '08:00', close_time: '22:00',
            });
            await reserve(21, 0);

            const response = await saveWeeklyHours([{ day_of_week: MONDAY, is_closed: true }]);

            expect(response.status).toBe(200);
        });

        test('released and past Reservations do not block a change', async () => {
            await reserve(21, 0, { status: 'released' });
            await reserve(21, 0, { date: '2029-12-31' }); // the Monday before the suite's clock

            const response = await saveWeeklyHours(mondayHours('08:00', '20:00'));

            expect(response.status).toBe(200);
        });

        test('Reservations in hours already past today do not block a change to today', async () => {
            // 2030-01-07 15:00 in Toronto; its 09:00 Reservation has played.
            jest.setSystemTime(new Date('2030-01-07T20:00:00.000Z'));
            ({ headers: admin } = await signInAs('admin', { fakeClock: true }));
            await reserve(9, 1);

            const response = await saveWeeklyHours(mondayHours('10:00', '22:00'));

            expect(response.status).toBe(200);
        });

        test('a day listed twice is refused as invalid, so the check cannot miss the saved one', async () => {
            await reserve(21, 0);

            const response = await saveWeeklyHours([
                ...mondayHours('08:00', '22:00'),
                ...mondayHours('08:00', '20:00'),
            ]);

            expect(response.status).toBe(400);
            expect(await mondayCloseTime()).toBe('22:00');
        });

        test('invalid hours are still refused as invalid', async () => {
            await reserve(21, 0);

            const response = await saveWeeklyHours(mondayHours('20:00', '08:00'));

            expect(response.status).toBe(400);
        });
    });

    describe('Special Hours', () => {
        const saveSpecialHours = (date, hours) => request(app)
            .put('/api/stores/store-one/special-hours').set(admin).send({ date, ...hours });

        test('closing on a reserved date is refused with the Reservations listed', async () => {
            await reserve(12, 1);
            await reserve(9, 1);

            const response = await saveSpecialHours(DATE, { is_closed: true, reason: 'Stocktake' });

            expect(response.status).toBe(409);
            expect(response.body.reservations.map(({ hour, position }) => [hour, position]))
                .toEqual([[9, 1], [12, 1]]);
            expect(await SpecialHoursRepository.getSpecialHours('store-one', DATE)).toBeNull();
        });

        test('closing on another date is saved', async () => {
            await reserve(12, 1);

            const response = await saveSpecialHours('2030-01-08', { is_closed: true, reason: 'Stocktake' });

            expect(response.status).toBe(200);
        });
    });

    describe('notification', () => {
        const notifications = async () => (await request(app).get('/api/notifications').set(admin)).body;

        test('the Admin is notified in-app of a blocked change', async () => {
            await reserve(21, 0);

            await saveWeeklyHours(mondayHours('08:00', '20:00'));

            const [notification, ...others] = await notifications();
            expect(others).toEqual([]);
            expect(notification).toMatchObject({
                title: 'Opening hours change blocked at Northwind Downtown',
                type: 'warning',
                read: false,
            });
            expect(notification.message).toContain('2030-01-07 21:00, Slot 1');
        });

        test('a change that is saved sends no notification', async () => {
            await saveWeeklyHours(mondayHours('08:00', '20:00'));

            expect(await notifications()).toEqual([]);
        });
    });
});
