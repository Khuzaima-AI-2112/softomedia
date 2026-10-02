import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { apiService } = vi.hoisted(() => ({ apiService: {
    getStores: vi.fn(),
    getScreens: vi.fn(),
} }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));
vi.mock('../../components/LocationManager', () => ({ default: () => null }));

import RetailerDashboard from './RetailerDashboard';

afterEach(() => vi.restoreAllMocks());

describe('RetailerDashboard', () => {
    // Nobody approves an Hourly Loop (ADR 0007); the Retailer previews the schedule instead.
    it('counts Stores and online Screens, and asks for no loop approval', async () => {
        apiService.getStores.mockResolvedValue([{ id: 'store_1' }, { id: 'store_2' }, { id: 'store_3' }]);
        apiService.getScreens.mockResolvedValue([{ id: 'screen_1', status: 'online' }, { id: 'screen_2', status: 'offline' }]);

        render(<MemoryRouter><RetailerDashboard /></MemoryRouter>);

        expect(await screen.findByText('3')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
        expect(screen.getByRole('link', { name: /schedule calendar/i })).toBeTruthy();
        expect(screen.queryByText(/approval/i)).toBeNull();
    });
});
