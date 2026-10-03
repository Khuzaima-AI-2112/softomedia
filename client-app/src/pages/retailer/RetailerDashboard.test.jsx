import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { apiService } = vi.hoisted(() => ({ apiService: {
    getStores: vi.fn(),
    getScreens: vi.fn(),
} }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));
vi.mock('../../components/LocationManager', () => ({ default: () => null }));
vi.mock('../../components/SupportTicketModal', () => ({
    default: ({ onClose, onTicketCreated }) => (
        <div role="dialog" aria-label="New Support Ticket">
            <button onClick={() => onTicketCreated({ id: 'ticket-1' })}>Submit Ticket</button>
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

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

    it('reports an issue and links to the Support Tickets', async () => {
        apiService.getStores.mockResolvedValue([]);
        apiService.getScreens.mockResolvedValue([]);

        render(<MemoryRouter><RetailerDashboard /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog', { name: 'New Support Ticket' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }));

        expect((await screen.findByRole('status')).textContent).toContain('Support Ticket submitted.');
        expect(screen.getByRole('link', { name: 'View Support Tickets' }).getAttribute('href')).toBe('/dashboard/tickets');
        expect(screen.queryByRole('dialog', { name: 'New Support Ticket' })).toBeNull();
    });
});
