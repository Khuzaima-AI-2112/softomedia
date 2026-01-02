import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ESM mocking requires top-level await or careful import order
// We use unstable_mockModule for the repositories
jest.unstable_mockModule('../src/repositories/index.js', () => ({
    screenRepository: {
        breaker: { getHealth: jest.fn(() => ({ state: 'CLOSED', failures: 0 })) },
        db: true
    },
    adRepository: {
        breaker: { getHealth: jest.fn(() => ({ state: 'CLOSED', failures: 0 })) }
    }
}));

// Now we can import the stuff that uses the mock
const { screenRepository } = await import('../src/repositories/index.js');
const { default: healthRouter } = await import('../src/api/health.js');

describe('Health API', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use('/api/health', healthRouter);
    });

    test('GET /api/health/v2 returns healthy status', async () => {
        const response = await request(app).get('/api/health/v2');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
        expect(response.body.diagnostics.persistence.mode).toBe('firestore');
    });

    test('GET /api/health/v2 returns degraded if breaker is open', async () => {
        // Mock implementation update
        screenRepository.breaker.getHealth.mockReturnValue({ state: 'OPEN', failures: 5 });

        const response = await request(app).get('/api/health/v2');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('degraded');
    });
});
