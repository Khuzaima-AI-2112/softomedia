import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';


// Mock dependencies
const mockGetEffectiveHours = jest.fn();
jest.unstable_mockModule('../src/services/BusinessHoursService.js', () => ({
    BusinessHoursService: {
        getEffectiveHours: mockGetEffectiveHours
    },
    default: {
        getEffectiveHours: mockGetEffectiveHours
    }
}));

import { createTestApp } from './fixtures/test-app.js';

describe('Schedule API', () => {
    let app;

    beforeEach(async () => {
        jest.resetModules();
        // Re-import router to ensure mocks are applied
        const routerModule = await import('../src/api/schedules.js');
        app = createTestApp(routerModule.default, '/api/schedules');
        mockGetEffectiveHours.mockReset();
    });

    describe('GET /api/schedules/preview', () => {
        it('should return 400 if storeId or date is missing', async () => {
            const res = await request(app).get('/api/schedules/preview');
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('should return preview with business hours for open store', async () => {
            mockGetEffectiveHours.mockResolvedValue({
                store_id: 'store_123',
                date: '2026-03-15',
                is_closed: false,
                open_time: '09:00',
                close_time: '21:00'
            });

            const res = await request(app).get('/api/schedules/preview?storeId=store_123&date=2026-03-15');

            expect(res.status).toBe(200);
            expect(res.body.store_id).toBe('store_123');
            expect(res.body.date).toBe('2026-03-15');
            expect(res.body.business_hours).toEqual({ start: '09:00', end: '21:00' });
            expect(Array.isArray(res.body.slots)).toBe(true);
        });

        it('should handle closed stores correctly', async () => {
            mockGetEffectiveHours.mockResolvedValue({
                store_id: 'store_123',
                date: '2026-03-15',
                is_closed: true,
                reason: 'Holiday'
            });

            const res = await request(app).get('/api/schedules/preview?storeId=store_123&date=2026-03-15');

            expect(res.status).toBe(200);
            expect(res.body.is_closed).toBe(true);
            expect(res.body.slots).toHaveLength(0);
        });
    });
});
