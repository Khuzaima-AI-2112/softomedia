import request from 'supertest';
import app from '../index.js'; // Note index.js is at ad-server/index.js

// Helper function to make requests as a specific role
const postAsRole = async (role, route, payload) => {
    return request(app)
        .post(route)
        .set('Authorization', 'Bearer demo-token')
        .set('x-demo-role', role)
        .send(payload);
};

// Helper for unauthenticated requests
const postUnauthenticated = async (route, payload) => {
    return request(app)
        .post(route)
        .send(payload);
};

describe('RBAC Creation Endpoints (POST)', () => {

    const roles = {
        SUPERADMIN: 'superadmin',
        ADMIN: 'admin',
        TECHOPERATOR: 'techoperator',
        CONTENTMANAGER: 'contentmanager',
        RETAILERADMIN: 'retaileradmin',
        ADVERTISER: 'advertiser'
    };

    describe('1. Users (requires superadmin)', () => {
        const route = '/api/users';
        const payload = {
            name: 'Test Name',
            email: 'test@example.com',
            role: 'advertiser',
            linkedentityid: 'adv_test'
        };

        it('should allow superadmin', async () => {
            const res = await postAsRole(roles.SUPERADMIN, route, payload);
            expect([201, 400]).toContain(res.status); // 400 is fine if mock user conflict, mostly want to see not 403
        });

        it('should deny admin and lower', async () => {
            const res = await postAsRole(roles.ADMIN, route, payload);
            expect(res.status).toBe(403);

            const resAdvertiser = await postAsRole(roles.ADVERTISER, route, payload);
            expect(resAdvertiser.status).toBe(403);
        });

        it('should deny unauthenticated requests', async () => {
            const res = await postUnauthenticated(route, payload);
            expect(res.status).toBe(401);
        });
    });

    describe('2. Retailers (requires admin)', () => {
        const route = '/api/retailers';
        const payload = {
            name: 'Test Retailer',
            contact_email: 'retailer@test.com'
        };

        it('should allow superadmin and admin', async () => {
            const resSuper = await postAsRole(roles.SUPERADMIN, route, payload);
            expect([201, 400]).toContain(resSuper.status);

            const resAdmin = await postAsRole(roles.ADMIN, route, payload);
            expect([201, 400]).toContain(resAdmin.status);
        });

        it('should deny advertiser', async () => {
            const res = await postAsRole(roles.ADVERTISER, route, payload);
            expect(res.status).toBe(403);
        });
    });

    describe('3. Screens (requires implicit authentication/registration check)', () => {
        const route = '/api/screens';
        const payload = {
            screen_id: 'test_scr_123',
            resolution: '1920x1080',
            user_agent: 'Jest',
            retailer_id: 'ret_001',
            store_id: 'store_001'
        };

        it('should allow superadmin and admin to register screens', async () => {
            const resSuper = await postAsRole(roles.SUPERADMIN, route, payload);
            expect([201, 400]).toContain(resSuper.status);

            const resAdmin = await postAsRole(roles.ADMIN, route, { ...payload, screen_id: 'test_scr_124' });
            expect([201, 400]).toContain(resAdmin.status);
        });

        // Note: Currently /api/screens only checks authenticate(), so even an advertiser
        // can insert a screen, though they can't get it.
        // It might be intended for device auto-registration or admin manual.
        // We will assert authentication is required.
        it('should deny unauthenticated requests', async () => {
            const res = await postUnauthenticated(route, payload);
            expect(res.status).toBe(401);
        });
    });

    describe('4. Campaigns (requires advertiser)', () => {
        const route = '/api/campaigns';
        const payload = {
            name: 'Test Campaign',
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            budget: 1000,
            retailerId: 'ret_active_1'
        };

        it('should allow advertiser and above (superadmin)', async () => {
            const resSuper = await postAsRole(roles.SUPERADMIN, route, payload);
            expect([201, 400]).toContain(resSuper.status);

            const resAdvertiser = await postAsRole(roles.ADVERTISER, route, payload);
            expect([201, 400]).toContain(resAdvertiser.status);
        });

        it('should deny unauthenticated', async () => {
            const res = await postUnauthenticated(route, payload);
            expect(res.status).toBe(401);
        });
    });

    describe('5. Schedules / Times (requires admin)', () => {
        const route = '/api/schedules';
        const payload = {
            name: 'New Schedule',
            rules: {}
        };

        it('should allow superadmin and admin', async () => {
            const resSuper = await postAsRole(roles.SUPERADMIN, route, payload);
            expect([201, 400]).toContain(resSuper.status);

            const resAdmin = await postAsRole(roles.ADMIN, route, payload);
            expect([201, 400]).toContain(resAdmin.status);
        });

        it('should deny content manager and lower', async () => {
            const res = await postAsRole(roles.CONTENTMANAGER, route, payload);
            expect(res.status).toBe(403);

            const resAdv = await postAsRole(roles.ADVERTISER, route, payload);
            expect(resAdv.status).toBe(403);
        });

        it('should deny unauthenticated', async () => {
            const res = await postUnauthenticated(route, payload);
            expect(res.status).toBe(401);
        });
    });

});
