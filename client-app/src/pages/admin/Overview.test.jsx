import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { user: { role: 'admin' } },
    apiService: {
        getRetailers: vi.fn(),
        getAdvertisers: vi.fn(),
        getScreens: vi.fn(),
        getUsers: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import AdminOverview from './Overview';

const renderOverview = () => render(<MemoryRouter><AdminOverview /></MemoryRouter>);

afterEach(() => vi.restoreAllMocks());

describe('AdminOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiService.getRetailers.mockResolvedValue([]);
        apiService.getAdvertisers.mockResolvedValue([]);
        apiService.getScreens.mockResolvedValue([]);
        apiService.getUsers.mockResolvedValue([]);
    });

    it('does not offer an Admin the Super Administrator pricing page (#23)', async () => {
        auth.user = { role: 'admin' };

        renderOverview();

        expect(await screen.findByText('Store Hours')).toBeTruthy();
        expect(screen.queryByText('CPM Pricing')).toBeNull();
    });

    it('offers a Super Administrator the pricing page', async () => {
        auth.user = { role: 'superadmin' };

        renderOverview();

        expect(await screen.findByText('CPM Pricing')).toBeTruthy();
    });

    // Nobody approves an Hourly Loop (ADR 0007).
    it('does not say loops are awaiting retailer approval', async () => {
        auth.user = { role: 'admin' };

        renderOverview();

        expect(await screen.findByText('Store Hours')).toBeTruthy();
        expect(screen.queryByText(/awaiting retailer approval/)).toBeNull();
    });
});
