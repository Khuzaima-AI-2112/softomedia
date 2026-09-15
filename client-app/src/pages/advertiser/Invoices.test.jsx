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

function renderAs(role) {
    auth.user = { id: `${role}-user`, role };
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
});
