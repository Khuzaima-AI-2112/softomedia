import { jest, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { platformAuditRepository } = await import('../src/repositories/index.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');
const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

const DEFAULTS = {
    breakfast: { start: 6, end: 11 },
    lunch: { start: 11, end: 15 },
    dinner: { start: 17, end: 21 },
};
const EARLY_BREAKFAST = { ...DEFAULTS, breakfast: { start: 5, end: 10 } };

describeWithAuthEmulator('network Dayparts', () => {
    beforeEach(() => clearMockStorage());

    const headersFor = async (role, organizationId) => (await signInAs(role, { organizationId })).headers;

    test('start at breakfast 06–11, lunch 11–15 and dinner 17–21, readable by every signed-in role', async () => {
        for (const role of ['superadmin', 'admin', 'retaileradmin', 'brand', 'techoperator']) {
            const response = await request(app).get('/api/dayparts').set(await headersFor(role, `${role}-org`));
            expect({ role, status: response.status, body: response.body })
                .toEqual({ role, status: 200, body: DEFAULTS });
        }
    });

    test('are not readable without signing in', async () => {
        expect((await request(app).get('/api/dayparts')).status).toBe(401);
    });

    test('are set by the Super Administrator for the whole network, with an audit record', async () => {
        const saved = await request(app).put('/api/dayparts')
            .set(await headersFor('superadmin')).send(EARLY_BREAKFAST);

        expect(saved.status).toBe(200);
        expect(saved.body).toEqual(EARLY_BREAKFAST);
        const read = await request(app).get('/api/dayparts').set(await headersFor('admin'));
        expect(read.body).toEqual(EARLY_BREAKFAST);
        expect(await platformAuditRepository.findAll()).toEqual([
            expect.objectContaining({ action: 'dayparts_updated', actor_role: 'superadmin', changes: EARLY_BREAKFAST }),
        ]);
    });

    test.each(['admin', 'retaileradmin', 'brand', 'techoperator'])('can\'t be changed by a %s', async role => {
        const denied = await request(app).put('/api/dayparts')
            .set(await headersFor(role, `${role}-org`)).send(EARLY_BREAKFAST);

        expect(denied.status).toBe(403);
        expect(denied.body).toMatchObject({ error: 'Forbidden', required: 'superadmin' });
        const read = await request(app).get('/api/dayparts').set(await headersFor('superadmin'));
        expect(read.body).toEqual(DEFAULTS);
        expect(await platformAuditRepository.findAll()).toEqual([]);
    });

    test('refuse overlapping or out-of-day hours, and keep what was saved', async () => {
        const superadmin = await headersFor('superadmin');
        const overlapping = await request(app).put('/api/dayparts').set(superadmin)
            .send({ ...DEFAULTS, lunch: { start: 10, end: 15 } });
        const pastMidnight = await request(app).put('/api/dayparts').set(superadmin)
            .send({ ...DEFAULTS, dinner: { start: 17, end: 25 } });

        expect([overlapping.status, pastMidnight.status]).toEqual([400, 400]);
        expect(overlapping.body.error).toBe('breakfast and lunch overlap');
        expect((await request(app).get('/api/dayparts').set(superadmin)).body).toEqual(DEFAULTS);
    });
});
