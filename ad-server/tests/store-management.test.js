import request from 'supertest';
import { clearMockStorage } from '../src/repositories/BaseRepository.js';
import StoreRepository from '../src/repositories/StoreRepository.js';
import { locationRepository } from '../src/repositories/index.js';
import { createTestApp } from './fixtures/test-app.js';

const { default: apiRouter } = await import('../src/api/index.js');
const app = createTestApp(apiRouter, '/api');

// A retailer of its own, so Stores other suites leave in the shared emulator never appear here.
const retailerId = `store-management-retailer-${Date.now()}`;

const retailerHeaders = {
    Authorization: 'Bearer demo-token',
    'x-demo-role': 'retaileradmin',
    'x-demo-retailer-id': retailerId,
};

const adminHeaders = {
    Authorization: 'Bearer demo-token',
    'x-demo-role': 'admin',
};

const secondaryRetailerHeaders = {
    Authorization: 'Bearer demo-token',
    'x-demo-role': 'retaileradmin',
    'x-demo-retailer-id': 'secondary-retailer',
};

describe('Retailer Administrator store management', () => {
    beforeEach(() => {
        clearMockStorage();
    });

    it('persists default local hours and isolates another retailer’s stores and locations', async () => {
        const created = await request(app)
            .post('/api/stores')
            .set(retailerHeaders)
            .send({
                name: 'Retailer Admin Toronto Store',
                retailer_id: retailerId,
                time_zone: 'America/Toronto',
            });

        expect(created.status).toBe(201);
        expect(created.body.time_zone).toBe('America/Toronto');

        const weeklyHours = await request(app)
            .get(`/api/stores/${created.body.id}/weekly-hours`)
            .set(retailerHeaders);

        expect(weeklyHours.status).toBe(200);
        expect(weeklyHours.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ day_of_week: 0, open_time: '08:00', close_time: '22:00', is_closed: false }),
            expect.objectContaining({ day_of_week: 6, open_time: '08:00', close_time: '22:00', is_closed: false }),
        ]));
        expect(weeklyHours.body).toHaveLength(7);

        const customizedWeeklyHours = weeklyHours.body.map(hours => {
            if (hours.day_of_week === 1) return { ...hours, open_time: '09:00', close_time: '17:00' };
            if (hours.day_of_week === 0) return { ...hours, is_closed: true };
            return hours;
        });
        const updatedHours = await request(app)
            .put(`/api/stores/${created.body.id}/weekly-hours`)
            .set(retailerHeaders)
            .send({ weekly_hours: customizedWeeklyHours });

        expect(updatedHours.status).toBe(200);
        const persistedHours = await request(app)
            .get(`/api/stores/${created.body.id}/weekly-hours`)
            .set(retailerHeaders);
        expect(persistedHours.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ day_of_week: 1, open_time: '09:00', close_time: '17:00', is_closed: false }),
            expect.objectContaining({ day_of_week: 0, is_closed: true }),
        ]));

        const ownLocation = await request(app)
            .post('/api/locations')
            .set(retailerHeaders)
            .send({ name: 'Entrance', store_id: created.body.id });

        expect(ownLocation.status).toBe(201);
        expect(ownLocation.body).toMatchObject({
            name: 'Entrance',
            store_id: created.body.id,
            retailer_id: retailerId,
        });

        const secondaryStore = await StoreRepository.createWithScreens({
            name: 'Secondary Retailer Store',
            retailer_id: 'secondary-retailer',
            time_zone: 'America/Phoenix',
        });
        await locationRepository.create('secondary-location', {
            name: 'Secondary Entrance',
            store_id: secondaryStore.id,
            retailer_id: 'secondary-retailer',
        });

        const stores = await request(app).get('/api/stores').set(retailerHeaders);
        expect(stores.status).toBe(200);
        expect(stores.body.map(({ id }) => id)).toEqual([created.body.id]);

        const locations = await request(app).get('/api/locations').set(retailerHeaders);
        expect(locations.status).toBe(200);
        expect(locations.body.map(({ id }) => id)).toEqual([ownLocation.body.id]);

        const switchedAccountStores = await request(app).get('/api/stores').set(secondaryRetailerHeaders);
        expect(switchedAccountStores.status).toBe(200);
        expect(switchedAccountStores.body.map(({ id }) => id)).toEqual([secondaryStore.id]);

        const switchedAccountLocations = await request(app).get('/api/locations').set(secondaryRetailerHeaders);
        expect(switchedAccountLocations.status).toBe(200);
        expect(switchedAccountLocations.body.map(({ id }) => id)).toEqual(['secondary-location']);

        for (const response of [
            await request(app).get(`/api/stores/${secondaryStore.id}`).set(retailerHeaders),
            await request(app).put(`/api/stores/${secondaryStore.id}/weekly-hours`).set(retailerHeaders).send({ weekly_hours: [] }),
            await request(app).post('/api/locations').set(retailerHeaders).send({ name: 'Forbidden', store_id: secondaryStore.id }),
        ]) {
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Access denied' });
            expect(JSON.stringify(response.body)).not.toContain('Secondary Retailer Store');
        }

        const administratorRead = await request(app).get(`/api/stores/${secondaryStore.id}`).set(adminHeaders);
        expect(administratorRead.status).toBe(200);
        expect(administratorRead.body.name).toBe('Secondary Retailer Store');
    });
});
