import { describe, expect, jest, test } from '@jest/globals';
import { OperationalHealthService } from '../src/services/OperationalHealthService.js';

describe('OperationalHealthService', () => {
    test('reports dependency probes independently', async () => {
        const service = new OperationalHealthService({
            firestoreProbe: jest.fn(async () => undefined),
            storageProbe: jest.fn(async () => {
                throw new Error('storage emulator unavailable');
            }),
            clock: () => new Date('2026-09-12T03:00:00.000Z'),
        });

        await expect(service.check()).resolves.toEqual({
            backend: { state: 'healthy' },
            firestore: { state: 'healthy' },
            storage: { state: 'unavailable' },
            checked_at: '2026-09-12T03:00:00.000Z',
        });
    });

    test('never reports an unchecked dependency as healthy', async () => {
        const service = new OperationalHealthService({
            firestoreProbe: jest.fn(async () => {
                throw new Error('firestore unavailable');
            }),
            storageProbe: jest.fn(async () => {
                throw new Error('storage unavailable');
            }),
        });

        const result = await service.check();
        expect(result.firestore.state).toBe('unavailable');
        expect(result.storage.state).toBe('unavailable');
    });
});
