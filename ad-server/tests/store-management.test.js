import request from 'supertest';
import { clearMockStorage } from '../src/repositories/BaseRepository.js';
import StoreRepository from '../src/repositories/StoreRepository.js';
import { locationRepository } from '../src/repositories/index.js';
import { createTestApp } from './fixtures/test-app.js';
import { describeWithAuthEmulator, signInAs } from './fixtures/emulator-sign-in.js';

const { default: apiRouter } = await import('../src/api/index.js');
const app = createTestApp(apiRouter, '/api');

// Retailers of their own, so Stores other suites leave in the shared emulator never appear here.
const retailerId = `store-management-retailer-${Date.now()}`;
const secondaryRetailerId = `store-management-secondary-${Date.now()}`;
const secondaryLocationId = `${secondaryRetailerId}-location`;

describeWithAuthEmulator('Retailer Administrator store management', () => {
    let retailerHeaders;
    let adminHeaders;
    let secondaryRetailerHeaders;

    beforeEach(async () => {
        clearMockStorage();
        ({ headers: retailerHeaders } = await signInAs('retaileradmin', { organizationId: retailerId }));
        ({ headers: adminHeaders } = await signInAs('admin'));
        ({ headers: secondaryRetailerHeaders } = await signInAs('retaileradmin', { organizationId: secondaryRetailerId }));
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
            retailer_id: secondaryRetailerId,
            time_zone: 'America/Phoenix',
        });
        await locationRepository.create(secondaryLocationId, {
            name: 'Secondary Entrance',
            store_id: secondaryStore.id,
            retailer_id: secondaryRetailerId,
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
        expect(switchedAccountLocations.body.map(({ id }) => id)).toEqual([secondaryLocationId]);

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

    // A Store's CPM traffic tier prices its Slots, so only the Super
    // Administrator sets it — a Retailer must not rate its own inventory.
    it('lets only a Super Administrator assign a Store’s CPM traffic tier', async () => {
        const { headers: superadminHeaders } = await signInAs('superadmin');
        const created = await request(app)
            .post('/api/stores')
            .set(retailerHeaders)
            .send({
                name: 'Tiered Store',
                retailer_id: retailerId,
                time_zone: 'America/Toronto',
                // Creation must not be a way around the assignment guard.
                cpm_traffic_tier: 'high',
            });
        expect(created.status).toBe(201);
        // A new Store carries no tier, so it prices at the standard rate.
        expect(created.body.cpm_traffic_tier).toBeUndefined();

        const byRetailer = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(retailerHeaders)
            .send({ cpm_traffic_tier: 'high' });
        expect(byRetailer.status).toBe(403);

        const byAdmin = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(adminHeaders)
            .send({ cpm_traffic_tier: 'high' });
        expect(byAdmin.status).toBe(403);

        const bySuperadmin = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(superadminHeaders)
            .send({ cpm_traffic_tier: 'high' });
        expect(bySuperadmin.status).toBe(200);
        expect(bySuperadmin.body.cpm_traffic_tier).toBe('high');

        // An unchanged tier echoed back with an ordinary edit is not a change.
        const unrelatedEdit = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(retailerHeaders)
            .send({ name: 'Tiered Store Renamed', cpm_traffic_tier: 'high' });
        expect(unrelatedEdit.status).toBe(200);
        expect(unrelatedEdit.body.name).toBe('Tiered Store Renamed');

        // Clearing the assignment returns the Store to the standard rate.
        const cleared = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(superadminHeaders)
            .send({ cpm_traffic_tier: null });
        expect(cleared.status).toBe(200);
        expect(cleared.body.cpm_traffic_tier).toBeNull();
    });

    // An unrecognised tier would price silently at 1.0x — INC-2026-01-12.
    it('refuses a CPM traffic tier the pricing configuration does not define', async () => {
        const { headers: superadminHeaders } = await signInAs('superadmin');
        const created = await request(app)
            .post('/api/stores')
            .set(retailerHeaders)
            .send({ name: 'Mistyped Tier Store', retailer_id: retailerId, time_zone: 'America/Toronto' });

        const mistyped = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(superadminHeaders)
            .send({ cpm_traffic_tier: 'hgih' });
        expect(mistyped.status).toBe(400);
        expect(mistyped.body.error).toMatch(/cpm_traffic_tier must be null or one of/);

        const reread = await request(app).get(`/api/stores/${created.body.id}`).set(superadminHeaders);
        expect(reread.body.cpm_traffic_tier).toBeUndefined();
    });

    // The Store's descriptive traffic level never moved a price and still does not.
    it('leaves the descriptive traffic_level freely editable and non-pricing', async () => {
        const created = await request(app)
            .post('/api/stores')
            .set(retailerHeaders)
            .send({ name: 'Descriptor Store', retailer_id: retailerId, time_zone: 'America/Toronto' });

        const described = await request(app)
            .patch(`/api/stores/${created.body.id}`)
            .set(retailerHeaders)
            .send({ traffic_level: 'high' });
        expect(described.status).toBe(200);
        expect(described.body.traffic_level).toBe('high');
        // Describing foot traffic does not assign a pricing tier.
        expect(described.body.cpm_traffic_tier).toBeUndefined();
    });
});
