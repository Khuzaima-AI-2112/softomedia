import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const api = vi.hoisted(() => ({
    getStores: vi.fn(),
    getWeeklyHours: vi.fn(),
    listSpecialHours: vi.fn(),
    updateWeeklyHours: vi.fn(),
    updateSpecialHours: vi.fn(),
}));

vi.mock('../../services/ApiService', () => ({ default: api }));

import BusinessHoursManagement from './BusinessHoursManagement';

const REFUSAL = new APIError(
    'This change would remove hours holding 2 Reservations at Northwind Downtown. Resolve them before changing the hours.',
    409,
    {
        code: 'HOURS_HOLD_RESERVATIONS',
        reservations: [
            { store_id: 'store-one', date: '2030-01-07', hour: 21, position: 0, campaign_id: 'campaign-one' },
            { store_id: 'store-one', date: '2030-01-14', hour: 9, position: 3, campaign_id: 'campaign-two' },
        ],
    },
);

describe('BusinessHoursManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.getStores.mockResolvedValue([{ id: 'store-one', name: 'Northwind Downtown' }]);
        api.getWeeklyHours.mockResolvedValue([]);
        api.listSpecialHours.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('lists the Reservations that block a change to the hours, and keeps them on screen', async () => {
        api.updateWeeklyHours.mockRejectedValue(REFUSAL);
        render(<BusinessHoursManagement />);
        await waitFor(() => expect(api.getWeeklyHours).toHaveBeenCalledWith('store-one'));

        vi.useFakeTimers();
        fireEvent.click(screen.getByTestId('btn-hours-save'));
        await act(async () => {});

        const refusal = screen.getByTestId('hours-save-confirmation');
        expect(refusal.textContent).toContain('would remove hours holding 2 Reservations');
        expect(screen.getByText('2030-01-07 21:00, Slot 1 (Campaign campaign-one)')).toBeTruthy();
        expect(screen.getByText('2030-01-14 09:00, Slot 4 (Campaign campaign-two)')).toBeTruthy();

        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(screen.queryByTestId('hours-save-confirmation')).toBeTruthy();
    });
});
