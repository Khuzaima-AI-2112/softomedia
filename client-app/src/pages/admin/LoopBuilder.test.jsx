import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { user: { role: 'admin' } },
    apiService: {
        getLoop: vi.fn(),
        getAssets: vi.fn(),
        replaceLoopSlot: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import LoopBuilder from './LoopBuilder';

const SUMMER_FIZZ = { id: 'summer-fizz', filename: 'summer-fizz.mp4', file_type: 'video/mp4' };
const FRESH_WEEK = { id: 'fresh-week', filename: 'fresh-week.jpg', file_type: 'image/jpeg' };
const BOLT = { id: 'bolt', filename: 'bolt.png', file_type: 'image/png' };

const LOOP = {
    id: 'loop-9',
    hour: 9,
    date: '2026-10-05',
    slots: [
        { asset_id: 'summer-fizz', asset_name: 'Summer Fizz' },
        { asset_id: 'fresh-week' },
        { asset_id: 'house-ad' },
        { asset_id: 'bolt', status: 'replaced' },
        {},
    ],
};

const renderBuilder = (id = LOOP.id) => render(
    <MemoryRouter initialEntries={[`/dashboard/admin/loops/${id}`]}>
        <Routes>
            <Route path="/dashboard/admin/loops/:id" element={<LoopBuilder />} />
            <Route path="/dashboard/admin/loops" element={<p>Loop Management page</p>} />
        </Routes>
    </MemoryRouter>
);

const renderLoaded = async () => {
    renderBuilder();
    await screen.findByRole('heading', { name: 'Loop Builder — 9:00 AM' });
};

const slotGrid = () => screen.getByRole('group', { name: 'Slot Configuration' });
const slotButtons = () => within(slotGrid()).getAllByRole('button');
const picker = () => screen.queryByRole('dialog', { name: /Select Asset for Slot/ });

afterEach(() => vi.restoreAllMocks());

describe('LoopBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.user = { role: 'admin' };
        // Render dates as a browser in Montréal would, so a date-only value
        // that slips to the day before shows up.
        const toLocaleDateString = Date.prototype.toLocaleDateString;
        vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locale, options) {
            return toLocaleDateString.call(this, locale, { timeZone: 'America/Toronto', ...options });
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiService.getLoop.mockResolvedValue(LOOP);
        apiService.getAssets.mockResolvedValue([SUMMER_FIZZ, FRESH_WEEK, BOLT]);
    });

    describe('reviewing an Hourly Loop', () => {
        it('names the hour and the broadcast day', async () => {
            await renderLoaded();

            expect(apiService.getLoop).toHaveBeenCalledWith('loop-9');
            expect(screen.getByText(/Monday, October 5, 2026 • 12 slots × 5 seconds = 60 second loop/)).toBeTruthy();
        });

        it('shows its twelve Slots in order with what fills each one', async () => {
            await renderLoaded();

            expect(slotButtons().map(button => button.getAttribute('aria-label'))).toEqual([
                'Slot 1: Summer Fizz — click to replace',
                'Slot 2: fresh-week.jpg — click to replace',
                'Slot 3: house-ad — click to replace',
                'Slot 4: bolt.png — click to replace',
                ...Array.from({ length: 8 }, (_, i) => `Slot ${i + 5}: empty — click to add asset`),
            ]);
            expect(screen.getByText('4/12 slots filled')).toBeTruthy();
        });

        it('marks each file as an image or a video', async () => {
            await renderLoaded();

            const [summer, fresh] = slotButtons();
            expect(within(summer).getByRole('img', { name: 'Video' })).toBeTruthy();
            expect(within(fresh).getByRole('img', { name: 'Image' })).toBeTruthy();
        });

        it('shows the Slots on a sixty-second timeline', async () => {
            await renderLoaded();

            const timeline = screen.getByRole('list', { name: 'Timeline Preview (60 seconds)' });
            const segments = within(timeline).getAllByRole('listitem');
            expect(segments).toHaveLength(12);
            expect(segments[0].getAttribute('title')).toBe('Slot 1: summer-fizz');
            expect(segments[11].getAttribute('title')).toBe('Slot 12: Empty');
        });

        it('goes back to Loop Management', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Back to Loop Management' }));

            expect(await screen.findByText('Loop Management page')).toBeTruthy();
        });
    });

    describe('replacing a Slot', () => {
        it("puts the chosen file in the Slot and says so", async () => {
            const replaced = { ...LOOP, slots: LOOP.slots.map((slot, i) => (i === 1 ? { asset_id: 'bolt', status: 'replaced' } : slot)) };
            apiService.replaceLoopSlot.mockResolvedValue(replaced);
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Slot 2: fresh-week.jpg — click to replace' }));
            const dialog = picker();
            expect(within(dialog).getAllByRole('button', { name: /^Select / }).map(b => b.textContent)).toEqual([
                expect.stringContaining('summer-fizz.mp4'),
                expect.stringContaining('fresh-week.jpg'),
                expect.stringContaining('bolt.png'),
            ]);
            fireEvent.click(within(dialog).getByRole('button', { name: 'Select bolt.png' }));

            expect(await screen.findByText('Slot 2 updated with "bolt.png".')).toBeTruthy();
            expect(apiService.replaceLoopSlot).toHaveBeenCalledWith('loop-9', 1, 'bolt');
            expect(picker()).toBeNull();
            expect(screen.getByRole('button', { name: 'Slot 2: bolt.png — click to replace' })).toBeTruthy();
        });

        it('fills an empty Slot', async () => {
            apiService.replaceLoopSlot.mockReturnValue(new Promise(() => {}));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Slot 5: empty — click to add asset' }));
            fireEvent.click(within(picker()).getByRole('button', { name: 'Select summer-fizz.mp4' }));

            const filled = screen.getByRole('button', { name: 'Slot 5: summer-fizz.mp4 — click to replace' });
            expect(within(filled).getByRole('img', { name: 'Video' })).toBeTruthy();
            expect(screen.getByText('5/12 slots filled')).toBeTruthy();
            expect(apiService.replaceLoopSlot).toHaveBeenCalledWith('loop-9', 4, 'summer-fizz');
        });

        it('closes the picker without changing anything', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Slot 1: Summer Fizz — click to replace' }));
            fireEvent.click(within(picker()).getByRole('button', { name: 'Close asset picker' }));

            expect(picker()).toBeNull();
            expect(apiService.replaceLoopSlot).not.toHaveBeenCalled();
        });

        it("says why a replacement failed and shows the loop as it is", async () => {
            apiService.replaceLoopSlot.mockRejectedValue(new APIError('Failed to replace slot', 500, { error: 'Failed to replace slot' }));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Slot 2: fresh-week.jpg — click to replace' }));
            fireEvent.click(within(picker()).getByRole('button', { name: 'Select bolt.png' }));

            expect(await screen.findByText('Failed to replace slot')).toBeTruthy();
            expect(await screen.findByRole('button', { name: 'Slot 2: fresh-week.jpg — click to replace' })).toBeTruthy();
            expect(apiService.getLoop).toHaveBeenCalledTimes(2);
        });
    });

    it('lets a Super Administrator look but not change anything', async () => {
        auth.user = { role: 'superadmin' };
        await renderLoaded();

        expect(screen.getByText('You can view this loop but not change it. Only an Admin replaces its Slots.')).toBeTruthy();
        const [first, , , , empty] = slotButtons();
        expect(first.getAttribute('aria-label')).toBe('Slot 1: Summer Fizz');
        expect(empty.getAttribute('aria-label')).toBe('Slot 5: empty');
        expect(first.disabled).toBe(true);
        fireEvent.click(first);
        expect(picker()).toBeNull();
    });

    it('treats a user without a role as read-only', async () => {
        auth.user = null;
        await renderLoaded();

        expect(slotButtons().every(button => button.disabled)).toBe(true);
    });

    describe('a loop that cannot be loaded', () => {
        beforeEach(() => {
            apiService.getLoop.mockRejectedValue(new APIError('Loop not found', 404, { error: 'Loop not found' }));
        });

        it('says so and offers the way back', async () => {
            renderBuilder('missing');

            expect(await screen.findByRole('heading', { name: 'Loop not found' })).toBeTruthy();
            expect(screen.getByText('Failed to load loop data. Please refresh.')).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: 'Back to Loop Management' }));
            expect(await screen.findByText('Loop Management page')).toBeTruthy();
        });
    });

    it('copes with a loop that has no Slots and no media', async () => {
        apiService.getLoop.mockResolvedValue({ id: 'loop-0', hour: 0, date: '2026-10-05' });
        apiService.getAssets.mockResolvedValue(null);
        renderBuilder('loop-0');

        expect(await screen.findByRole('heading', { name: 'Loop Builder — 12:00 AM' })).toBeTruthy();
        expect(screen.getByText('0/12 slots filled')).toBeTruthy();
        await waitFor(() => expect(slotButtons()).toHaveLength(12));
    });
});
