import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { user: { role: 'admin' } },
    apiService: {
        getRetailers: vi.fn(),
        getAdvertisers: vi.fn(),
        getScreens: vi.fn(),
        getUsers: vi.fn(),
        createRetailer: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import AdminOverview from './Overview';

const renderOverview = () => render(
    <MemoryRouter initialEntries={['/dashboard/admin']}>
        <Routes>
            <Route path="/dashboard/admin" element={<AdminOverview />} />
            <Route path="/dashboard/admin/map" element={<p>Network map page</p>} />
        </Routes>
    </MemoryRouter>
);

// The figure shown on the stat card headed by `label`.
const statCard = (label) => screen.getByText(label, { selector: 'p' }).parentElement;

const RETAILERS = [
    { id: 'r1', name: 'FreshMart', logo: '🛒', status: 'active' },
    { id: 'r2', name: 'QuickStop', logo: '⛽', status: 'inactive' },
    { id: 'r3', name: 'Corner Deli', logo: '🥪', status: 'active' },
    { id: 'r4', name: 'BookNook', logo: '📚', status: 'active' },
    { id: 'r5', name: 'PetPal', logo: '🐾', status: 'active' },
];
const ADVERTISERS = [
    { id: 'a1', name: 'Bolt Drinks', logo: '⚡', budget: 2400 },
    { id: 'a2', name: 'Sunny Snacks', logo: '☀️' },
];
const SCREENS = [
    { id: 's1', status: 'online' },
    { id: 's2', status: 'offline' },
    { id: 's3', status: 'online' },
];

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

    describe('for a Super Administrator', () => {
        beforeEach(() => {
            auth.user = { role: 'superadmin' };
            apiService.getRetailers.mockResolvedValue(RETAILERS);
            apiService.getAdvertisers.mockResolvedValue(ADVERTISERS);
            apiService.getScreens.mockResolvedValue(SCREENS);
            apiService.getUsers.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
        });

        it('counts Retailers, Advertisers, Screens online and platform users', async () => {
            renderOverview();

            await waitFor(() => expect(screen.getByTestId('stat-value-retailers').textContent).toBe('5'));
            expect(screen.getByTestId('stat-value-advertisers').textContent).toBe('2');
            expect(within(statCard('Screens Online')).getByText('2')).toBeTruthy();
            expect(within(statCard('Screens Online')).getByText('of 3 total')).toBeTruthy();
            expect(within(statCard('Platform Users')).getByText('2')).toBeTruthy();
        });

        it('offers the Screens and Users pages alongside the shared ones', async () => {
            renderOverview();

            for (const page of ['CPM Pricing', 'Screens', 'Users', 'Retailers', 'Advertisers', 'Store Hours', 'Network Map']) {
                expect(await screen.findByRole('link', { name: new RegExp(`${page}$`) })).toBeTruthy();
            }
        });

        it('lists the first four Retailers with their status', async () => {
            renderOverview();

            const freshMart = (await screen.findByText('FreshMart')).closest('a');

            for (const name of ['QuickStop', 'Corner Deli', 'BookNook']) expect(screen.getByText(name)).toBeTruthy();
            expect(screen.queryByText('PetPal')).toBeNull();
            expect(within(freshMart).getByText('Active')).toBeTruthy();
            expect(within(screen.getByText('QuickStop').closest('a')).getByText('Inactive')).toBeTruthy();
        });

        it('lists Advertisers with their budget', async () => {
            renderOverview();

            const bolt = (await screen.findByText('Bolt Drinks')).closest('a');
            expect(within(bolt).getByText('$2,400.00')).toBeTruthy();
            expect(within(screen.getByText('Sunny Snacks').closest('a')).getByText('$0.00')).toBeTruthy();
        });
    });

    describe('for an Admin', () => {
        beforeEach(() => {
            auth.user = { role: 'admin' };
        });

        it('does not ask for the user list, nor offer the Super Administrator pages', async () => {
            renderOverview();

            expect(await screen.findByText('Store Hours')).toBeTruthy();
            expect(apiService.getUsers).not.toHaveBeenCalled();
            expect(screen.queryByRole('link', { name: /Users$/ })).toBeNull();
            expect(screen.queryByRole('link', { name: /Screens$/ })).toBeNull();
        });
    });

    it('still shows the other figures when one source fails or answers oddly', async () => {
        auth.user = { role: 'superadmin' };
        apiService.getRetailers.mockRejectedValue(new APIError('Failed to fetch retailers', 500, { error: 'Failed to fetch retailers' }));
        apiService.getAdvertisers.mockResolvedValue({ unexpected: true });
        apiService.getScreens.mockResolvedValue(SCREENS);
        apiService.getUsers.mockRejectedValue(new APIError('Failed to fetch users', 500, { error: 'Failed to fetch users' }));

        renderOverview();

        await waitFor(() => expect(within(statCard('Screens Online')).getByText('of 3 total')).toBeTruthy());
        expect(screen.getByTestId('stat-value-retailers').textContent).toBe('0');
        expect(screen.getByTestId('stat-value-advertisers').textContent).toBe('0');
    });

    it('opens the network map', async () => {
        renderOverview();

        fireEvent.click(await screen.findByRole('button', { name: 'Network Map' }));

        expect(await screen.findByText('Network map page')).toBeTruthy();
    });

    // The form itself is broken (#77); these cover only what it does today and stays true after the fix.
    describe('the New Retailer form', () => {
        const openForm = async () => {
            renderOverview();
            fireEvent.click(await screen.findByRole('button', { name: /New Retailer/ }));
            return screen.getByTestId('modal-retailer-form');
        };
        const fill = (name, email) => {
            fireEvent.change(screen.getByPlaceholderText('e.g. Acme Retail Corp'), { target: { value: name } });
            fireEvent.change(screen.getByPlaceholderText('admin@retailer.com'), { target: { value: email } });
        };

        beforeEach(() => {
            auth.user = { role: 'superadmin' };
        });

        it('does not submit until both name and email are filled', async () => {
            const form = await openForm();

            fill('FreshMart', '');
            fireEvent.click(within(form).getByRole('button', { name: 'Create Account' }));

            expect(apiService.createRetailer).not.toHaveBeenCalled();
            expect(screen.getByTestId('modal-retailer-form')).toBeTruthy();
        });

        it('closes and refreshes the figures once the Retailer is created', async () => {
            apiService.createRetailer.mockResolvedValue({ id: 'r9' });
            const form = await openForm();

            fill('FreshMart', 'ops@freshmart.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Create Account' }));

            await waitFor(() => expect(screen.queryByTestId('modal-retailer-form')).toBeNull());
            expect(apiService.getRetailers).toHaveBeenCalledTimes(2);
        });

        it('stays open when the server refuses', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const reason = 'Contact email is required | Contract start date is required';
            apiService.createRetailer.mockRejectedValue(new APIError(reason, 400, { error: reason }));
            const form = await openForm();

            fill('FreshMart', 'ops@freshmart.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Create Account' }));

            await waitFor(() => expect(apiService.createRetailer).toHaveBeenCalled());
            expect(screen.getByTestId('modal-retailer-form')).toBeTruthy();
        });

        it('closes without saving on Cancel', async () => {
            const form = await openForm();

            fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByTestId('modal-retailer-form')).toBeNull();
            expect(apiService.createRetailer).not.toHaveBeenCalled();
        });
    });
});
