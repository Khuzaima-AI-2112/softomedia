import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient } = vi.hoisted(() => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../services/api', () => ({ default: apiClient }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ persona: 'retaileradmin' }) }));
vi.mock('../../components/LoopPreviewModal', () => ({ default: () => null }));

import ScheduleCalendar from './ScheduleCalendar';

const STORE = { id: 'store-one', name: 'Northwind Downtown', time_zone: 'America/Toronto' };
const SAVED = { id: 'sched_1', store_id: 'store-one', day: 'sunday', start: '09:00', end: '11:00', type: 'blocked' };

function serve(overrides) {
    apiClient.get.mockImplementation(async (endpoint) => {
        if (endpoint === '/api/stores') return [STORE];
        if (endpoint.startsWith('/api/loops/review/')) return { loops: [], approval_window: null };
        if (endpoint === '/api/schedules?store_id=store-one') return overrides;
        throw new Error(`Unexpected GET ${endpoint}`);
    });
}

async function addOverride({ day, start, end, type }) {
    fireEvent.click(await screen.findByTestId('btn-add-schedule-override'));
    fireEvent.change(screen.getByTestId('select-override-day'), { target: { value: day } });
    fireEvent.change(screen.getByTestId('input-override-start'), { target: { value: start } });
    fireEvent.change(screen.getByTestId('input-override-end'), { target: { value: end } });
    fireEvent.change(screen.getByTestId('select-override-type'), { target: { value: type } });
    fireEvent.click(screen.getByTestId('btn-override-form-submit'));
}

describe('ScheduleCalendar schedule overrides (#16)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the Store\'s saved overrides when the page loads', async () => {
        serve([SAVED]);

        render(<ScheduleCalendar />);

        const list = await screen.findByTestId('schedule-overrides');
        expect(await within(list).findByText('Sunday 09:00–11:00 · Blocked (No Ads)')).toBeTruthy();
    });

    it('says when the Store has no overrides', async () => {
        serve([]);

        render(<ScheduleCalendar />);

        expect(await screen.findByText('No schedule overrides for this Store.')).toBeTruthy();
    });

    it('saves an override for the selected Store and lists it', async () => {
        serve([]);
        apiClient.post.mockResolvedValue({ ...SAVED, id: 'sched_2', day: 'monday', type: 'forced' });

        render(<ScheduleCalendar />);
        await screen.findByText('No schedule overrides for this Store.');
        await addOverride({ day: 'monday', start: '09:00', end: '11:00', type: 'forced' });

        await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/schedules', {
            store_id: 'store-one', day: 'monday', start: '09:00', end: '11:00', type: 'forced',
        }));
        expect(await screen.findByText('Monday 09:00–11:00 · Forced Playlist')).toBeTruthy();
        expect(screen.queryByTestId('modal-schedule-override-form')).toBeNull();
    });

    it('does not list a save that finishes after the user has switched Store', async () => {
        const other = { id: 'store-two', name: 'Northwind Uptown', time_zone: 'America/Toronto' };
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE, other];
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [], approval_window: null };
            if (endpoint.startsWith('/api/schedules?store_id=')) return [];
            throw new Error(`Unexpected GET ${endpoint}`);
        });
        let finishSave;
        apiClient.post.mockReturnValue(new Promise(resolve => { finishSave = resolve; }));

        render(<ScheduleCalendar />);
        await screen.findByText('No schedule overrides for this Store.');
        await addOverride({ day: 'sunday', start: '09:00', end: '11:00', type: 'blocked' });
        fireEvent.change(screen.getByTestId('schedule-store-select'), { target: { value: 'store-two' } });
        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/schedules?store_id=store-two'));
        finishSave(SAVED);

        await waitFor(() => expect(screen.queryByTestId('modal-schedule-override-form')).toBeNull());
        expect(screen.queryByText('Sunday 09:00–11:00 · Blocked (No Ads)')).toBeNull();
    });

    it('keeps an override saved before the Store\'s list finished loading', async () => {
        let finishLoad;
        apiClient.get.mockImplementation((endpoint) => {
            if (endpoint === '/api/stores') return Promise.resolve([STORE]);
            if (endpoint.startsWith('/api/loops/review/')) return Promise.resolve({ loops: [], approval_window: null });
            return new Promise(resolve => { finishLoad = resolve; });
        });
        apiClient.post.mockResolvedValue(SAVED);

        render(<ScheduleCalendar />);
        await addOverride({ day: 'sunday', start: '09:00', end: '11:00', type: 'blocked' });
        await screen.findByText('Sunday 09:00–11:00 · Blocked (No Ads)');
        // The list was read before the save reached the server.
        finishLoad([]);

        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/schedules?store_id=store-one'));
        expect(await screen.findByText('Sunday 09:00–11:00 · Blocked (No Ads)')).toBeTruthy();
        expect(screen.queryByText('No schedule overrides for this Store.')).toBeNull();
    });

    it('keeps the dialog open with the server\'s reason when the save is refused', async () => {
        serve([]);
        apiClient.post.mockRejectedValue(new Error('end must be after start'));

        render(<ScheduleCalendar />);
        await addOverride({ day: 'monday', start: '11:00', end: '09:00', type: 'blocked' });

        expect(await screen.findByText('end must be after start')).toBeTruthy();
        expect(screen.getByTestId('modal-schedule-override-form')).toBeTruthy();
        expect(screen.getByText('No schedule overrides for this Store.')).toBeTruthy();
    });
});
