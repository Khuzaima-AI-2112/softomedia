import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { user: { role: 'admin' } },
    apiService: {
        getRetailers: vi.fn(),
        getAdvertisers: vi.fn(),
        getScreens: vi.fn(),
        getLoops: vi.fn(),
        getUsers: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import AdminOverview from './Overview';

const renderOverview = () => render(<MemoryRouter><AdminOverview /></MemoryRouter>);

describe('AdminOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiService.getRetailers.mockResolvedValue([]);
        apiService.getAdvertisers.mockResolvedValue([]);
        apiService.getScreens.mockResolvedValue([]);
        apiService.getUsers.mockResolvedValue([]);
        apiService.getLoops.mockResolvedValue({ loops: [], business_hours: { start: 8, end: 22 } });
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

    it('counts loops awaiting approval from the { loops, business_hours } response (#26)', async () => {
        auth.user = { role: 'admin' };
        apiService.getLoops.mockResolvedValue({
            loops: [{ status: 'PENDING_APPROVAL' }, { status: 'PENDING_APPROVAL' }, { status: 'APPROVED' }],
            business_hours: { start: 8, end: 22 },
        });

        renderOverview();

        expect(await screen.findByText(/2 loops awaiting retailer approval/)).toBeTruthy();
    });
});
