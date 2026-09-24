import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { apiService } = vi.hoisted(() => ({ apiService: {
    getPricingConfig: vi.fn(),
    getRetailers: vi.fn(),
    getStores: vi.fn(),
    getEffectiveHours: vi.fn(),
} }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import CPMCalendar from './CPMCalendar';

describe('CPMCalendar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiService.getRetailers.mockResolvedValue([]);
        apiService.getStores.mockResolvedValue([]);
    });

    it('explains a refused pricing configuration instead of loading forever (#23)', async () => {
        apiService.getPricingConfig.mockRejectedValue(new APIError('Forbidden', 403));

        render(<CPMCalendar />);

        expect(await screen.findByRole('alert')).toHaveProperty(
            'textContent', 'Pricing is managed by the Super Administrator. Your account cannot view it.',
        );
        expect(screen.queryByText(/Loading pricing configuration/)).toBeNull();
    });

    it('reads the selected store\'s effective hours for the selected date (#25)', async () => {
        apiService.getPricingConfig.mockResolvedValue({ baseCPM: 15, trafficTiers: {} });
        apiService.getStores.mockResolvedValue([{ id: 'store_1', name: 'North Store', retailer_id: 'ret_1' }]);
        apiService.getEffectiveHours.mockResolvedValue({ open_time: '09:00', close_time: '17:00', is_closed: false });

        render(<CPMCalendar />);

        await waitFor(() => expect(apiService.getEffectiveHours).toHaveBeenCalledWith(
            'store_1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        ));
        expect(await screen.findByText('09:00 - 17:00')).toBeTruthy();
    });
});
