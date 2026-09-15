import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request, auth } = vi.hoisted(() => ({
    request: vi.fn(),
    auth: { user: null },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: { request } }));

import Invoices from './Invoices';

// The profile's explicit grants, as GET /api/auth/me returns them.
const GRANTS = {
    brand: ['campaigns.create', 'invoices.view_own'],
    retaileradmin: ['campaigns.approve', 'support_ticket.create_own'],
};

function renderAs(role, permissions = GRANTS[role] ?? []) {
    auth.user = { id: `${role}-user`, role, permissions };
    auth.can = permission => permissions.includes(permission);
    render(
        <MemoryRouter initialEntries={['/dashboard/advertiser/invoices']}>
            <Routes>
                <Route path="/dashboard/advertiser/invoices" element={<Invoices />} />
                <Route path="/dashboard" element={<p>Dashboard home</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('Invoices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        request.mockResolvedValue({ invoices: [] });
    });

    it('shows a signed-in Brand its own invoices', async () => {
        renderAs('brand');

        expect(await screen.findByText('No invoices yet.')).toBeTruthy();
        expect(request).toHaveBeenCalledWith('GET', '/invoices');
    });

    it('sends a Retailer Administrator back to the dashboard', async () => {
        renderAs('retaileradmin');

        expect(await screen.findByText('Dashboard home')).toBeTruthy();
        await waitFor(() => expect(request).not.toHaveBeenCalled());
    });

    it('follows the invoice grant rather than the role name', async () => {
        renderAs('retaileradmin', ['invoices.view_network']);

        expect(await screen.findByText('No invoices yet.')).toBeTruthy();
    });
});
