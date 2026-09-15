import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const campaignRepository = {
    findById: jest.fn(async () => ({ id: 'campaign-1', status: 'pending_approval' })),
};
const campaignService = {
    updateStatus: jest.fn(async (_id, status) => ({ id: 'campaign-1', status })),
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({
    campaignRepository,
    impressionRepository: {},
    locationRepository: {},
    loopRepository: {},
    mediaRepository: {},
    retailerRepository: {},
    screenRepository: {},
    StoreRepository: {},
}));
jest.unstable_mockModule('../src/services/CampaignService.js', () => ({ campaignService }));
jest.unstable_mockModule('../src/services/AuthService.js', () => ({
    authService: { resolveFirebaseIdentity: jest.fn() },
}));
jest.unstable_mockModule('../src/utils/firebaseAuth.js', () => ({ getFirebaseAuth: jest.fn() }));

const { default: campaignsRouter } = await import('../src/api/campaigns.js');
const { default: invoicesRouter } = await import('../src/api/invoices.js');

function campaignAppFor(role) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.headers.authorization = 'Bearer demo-token';
        req.headers['x-demo-role'] = role;
        next();
    });
    app.use('/api/campaigns', campaignsRouter);
    return app;
}

describe('Technical Operator authority boundary', () => {
    test('cannot approve a Campaign', async () => {
        const response = await request(campaignAppFor('techoperator'))
            .patch('/api/campaigns/campaign-1/status')
            .send({ status: 'approved' });

        expect(response.status).toBe(403);
        expect(campaignService.updateStatus).not.toHaveBeenCalled();
    });

    test('cannot generate invoices', async () => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { id: 'techoperator-user', role: 'techoperator' };
            next();
        });
        app.use('/api/invoices', invoicesRouter);

        const response = await request(app)
            .post('/api/invoices/generate')
            .send({ campaignId: 'campaign-1' });

        expect(response.status).toBe(403);
    });
});
