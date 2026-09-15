import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';
// A revision that still carries the retired switch must behave exactly like one without it.
process.env.ALLOW_DEMO_MODE = 'true';

jest.setTimeout(30_000);

const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');

describeWithAuthEmulator('the retired demo mode switch', () => {
    const campaignId = `retired-demo-mode-campaign-${Date.now()}`;
    let request;
    let app;
    let campaignRepository;
    let admin;

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        ({ campaignRepository } = await import('../src/repositories/index.js'));
        ({ default: app } = await import('../index.js'));
        ({ headers: admin } = await signInAs('admin'));
        await campaignRepository.create(campaignId, { name: 'Still running', status: 'active', impressions_delivered: 10 });
    });

    afterAll(async () => {
        await campaignRepository.delete(campaignId);
    });

    test('does not let an Admin invoice a Campaign that has not completed', async () => {
        const response = await request(app).post('/api/invoices/generate').set(admin).send({ campaignId });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Campaign must be completed' });
    });

    test('serves no mock schedule history or mock schedule markers', async () => {
        const history = await request(app).get('/api/schedules/history').set(admin);
        const override = await request(app).post('/api/schedules').set(admin).send({ name: 'Override' });

        expect(history.status).toBe(404);
        expect(history.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ actorId: 'demo-freshmart' })]));
        expect(override.headers['x-demo-source']).toBeUndefined();
        expect(override.body.id).not.toMatch(/^sched_demo_/);
    });
});
