import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOperationalHealth, getScreenStatus } = vi.hoisted(() => ({
    getOperationalHealth: vi.fn(),
    getScreenStatus: vi.fn(),
}));

vi.mock('../services/ApiService', () => ({
    default: { getOperationalHealth, getScreenStatus },
}));

import Health from './Health';

describe('Technical Operator Health', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOperationalHealth.mockResolvedValue({
            backend: { state: 'healthy' },
            firestore: { state: 'unavailable' },
            storage: { state: 'healthy' },
            checked_at: '2026-09-12T03:00:00.000Z',
        });
        getScreenStatus.mockResolvedValue({
            total: 1,
            online: 1,
            offline: 0,
            screens: [{
                id: 'screen-entrance-1',
                connectivity: 'online',
                last_seen: '2026-09-12T02:59:30.000Z',
                schedule: { state: 'unavailable', approved: false },
            }],
        });
    });

    it('renders dependency, connectivity, and schedule states independently', async () => {
        render(<Health />);

        expect(await screen.findByText('Unavailable')).toBeTruthy();
        expect(screen.getByTestId('health-chip-firestore').dataset.status).toBe('unavailable');
        expect(screen.getByTestId('health-chip-storage').dataset.status).toBe('healthy');
        expect(screen.getByText('screen-entrance-1')).toBeTruthy();
        expect(screen.getByText('Online')).toBeTruthy();
        expect(screen.getByText('No approved schedule')).toBeTruthy();
    });
});
