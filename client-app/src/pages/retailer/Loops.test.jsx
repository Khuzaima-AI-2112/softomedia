import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiService } = vi.hoisted(() => ({ apiService: { getLoops: vi.fn() } }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import { APIError } from '../../services/api';
import RetailerLoops from './Loops';

const loop = (date, hour, slots = 12) => ({
    id: `${date}_${hour}_store-one`, date, hour, store_id: 'store-one',
    slots: Array.from({ length: slots }, (_, position) => ({ position })),
});

const renderPage = () => render(<MemoryRouter><RetailerLoops /></MemoryRouter>);

afterEach(() => vi.restoreAllMocks());

describe('Retailer Loop Library', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists the Retailer\'s loops, newest day first and in hour order, each linking to its loop', async () => {
        // GET /api/loops answers in document-id order, which puts 10:00 before 8:00.
        apiService.getLoops.mockResolvedValue({
            loops: [loop('2030-01-15', 9), loop('2030-01-16', 10), loop('2030-01-16', 8, 1)],
            business_hours: { start: 8, end: 22 },
        });

        renderPage();

        const rows = await screen.findAllByRole('link', { name: 'View' });
        expect(rows.map(link => link.getAttribute('href'))).toEqual([
            '/dashboard/admin/loops/2030-01-16_8_store-one',
            '/dashboard/admin/loops/2030-01-16_10_store-one',
            '/dashboard/admin/loops/2030-01-15_9_store-one',
        ]);
        const first = screen.getByTestId('loop-row-2030-01-16_8_store-one');
        expect(within(first).getByText('Loop 2030-01-16_8_store-one')).toBeTruthy();
        expect(within(first).getByText(/2030-01-16 • 8:00 slot/)).toBeTruthy();
        expect(within(first).getByText('1 slot')).toBeTruthy();
        expect(within(screen.getByTestId('loop-row-2030-01-16_10_store-one')).getByText('12 slots')).toBeTruthy();
        expect(screen.getByRole('link', { name: '← Schedule Calendar' }).getAttribute('href'))
            .toBe('/dashboard/retailer/schedule');
    });

    it('shows a loop\'s name, and says when it has no date or hour', async () => {
        apiService.getLoops.mockResolvedValue([{ id: 'loop-x', name: 'Opening loop' }]);

        renderPage();

        const row = await screen.findByTestId('loop-row-loop-x');
        expect(within(row).getByText('Opening loop')).toBeTruthy();
        expect(within(row).getByText('No hour assigned')).toBeTruthy();
    });

    it('says when there are no loops', async () => {
        apiService.getLoops.mockResolvedValue({ loops: [] });

        renderPage();

        expect(await screen.findByText('No loops found for your locations.')).toBeTruthy();
    });

    it('says why the loops could not be loaded', async () => {
        apiService.getLoops.mockRejectedValue(new APIError('Failed to fetch loops', 500, { error: 'Failed to fetch loops' }));

        renderPage();

        expect(await screen.findByText('Failed to load loops: Failed to fetch loops')).toBeTruthy();
        expect(screen.queryByText('No loops found for your locations.')).toBeNull();
    });
});
