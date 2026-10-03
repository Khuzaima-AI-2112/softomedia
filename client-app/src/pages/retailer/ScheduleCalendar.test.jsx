import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient } = vi.hoisted(() => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../services/api', async (importOriginal) => ({ ...await importOriginal(), default: apiClient }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ persona: 'retaileradmin' }) }));
vi.mock('../../components/LoopPreviewModal', () => ({
    default: ({ loop, onClose }) => (
        <div data-testid="loop-preview-modal">
            <p>Preview of {loop.id}</p>
            <button onClick={onClose}>Close preview</button>
        </div>
    ),
}));

import { APIError } from '../../services/api';
import ScheduleCalendar from './ScheduleCalendar';

const STORE = { id: 'store-one', name: 'Northwind Downtown', time_zone: 'America/Toronto' };
const SAVED = { id: 'sched_1', store_id: 'store-one', day: 'sunday', start: '09:00', end: '11:00', type: 'blocked' };

function serve(overrides) {
    apiClient.get.mockImplementation(async (endpoint) => {
        if (endpoint === '/api/stores') return [STORE];
        if (endpoint.startsWith('/api/loops/review/')) return { loops: [] };
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

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// Nobody approves an Hourly Loop (ADR 0007); the Retailer Administrator previews it (#21).
describe('ScheduleCalendar schedule preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the generated loops with no approval action or deadline', async () => {
        const loop = { id: 'loop-8', hour: 8, date: '2030-01-16', slots: [{ position: 0, asset_id: 'ast_1' }] };
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE];
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [loop] };
            if (endpoint === '/api/schedules?store_id=store-one') return [];
            throw new Error(`Unexpected GET ${endpoint}`);
        });

        render(<ScheduleCalendar />);

        await waitFor(() => expect(screen.getByTestId('loops-generated').textContent).toBe('1'));
        expect(screen.getByTestId('schedule-hour-8').disabled).toBe(false);
        expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
        expect(screen.queryByText(/approval deadline/i)).toBeNull();
        expect(screen.queryByText(/pending/i)).toBeNull();
    });
});

describe('ScheduleCalendar broadcast date and timeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('names the Store\'s tomorrow, not the day before, west of UTC', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2030-01-15T15:00:00Z'));
        const toLocaleDateString = Date.prototype.toLocaleDateString;
        vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locale, options) {
            return toLocaleDateString.call(this, locale, { timeZone: 'America/Toronto', ...options });
        });
        serve([]);

        render(<ScheduleCalendar />);

        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/loops/review/store-one/2030-01-16'));
        expect(screen.getByText('Wednesday, January 16')).toBeTruthy();
        expect(screen.getByTestId('store-time-zone').textContent).toBe('Store time zone: America/Toronto');
    });

    it('lists every hour from the first loop to the last, and the hours in between without one', async () => {
        const loops = [
            { id: 'loop-9', hour: 9, slots: [{ position: 0, asset_id: 'ast_1' }] },
            { id: 'loop-11', hour: 11, slots: [] },
        ];
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE];
            if (endpoint.startsWith('/api/loops/review/')) return { loops };
            return [];
        });

        render(<ScheduleCalendar />);

        await waitFor(() => expect(screen.getByTestId('loops-generated').textContent).toBe('2'));
        const timeline = screen.getByTestId('schedule-timeline');
        expect(within(timeline).getAllByRole('button').map(button => button.textContent)).toEqual([
            expect.stringContaining('9:00 AM'),
            expect.stringContaining('10:00 AM'),
            expect.stringContaining('11:00 AM'),
        ]);
        expect(within(screen.getByTestId('schedule-hour-10')).getByText('No loop generated')).toBeTruthy();
        expect(screen.getByTestId('schedule-hour-10').disabled).toBe(true);
        expect(screen.getByText('9:00 AM – 12:00 PM')).toBeTruthy();
        expect(screen.queryByTestId('no-data-state')).toBeNull();
    });

    it('ends the hours at midnight when the last loop is at 11 PM', async () => {
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE];
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [{ id: 'loop-23', hour: 23, slots: [] }] };
            return [];
        });

        render(<ScheduleCalendar />);

        expect(await screen.findByText('11:00 PM – 12:00 AM')).toBeTruthy();
    });

    it('opens the loop preview for an hour that has a loop', async () => {
        const loop = { id: 'loop-8', hour: 8, slots: [] };
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE];
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [loop] };
            return [];
        });

        render(<ScheduleCalendar />);
        await waitFor(() => expect(screen.getByTestId('loops-generated').textContent).toBe('1'));
        fireEvent.click(screen.getByRole('button', { name: /8:00 AM/ }));

        expect(await screen.findByTestId('loop-preview-modal')).toBeTruthy();
        expect(screen.getByText('Preview of loop-8')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
        expect(screen.queryByTestId('loop-preview-modal')).toBeNull();
    });

    it('says the schedule has not been generated when the Store has no loops', async () => {
        serve([]);

        render(<ScheduleCalendar />);

        expect(await screen.findByText('No Schedule Available')).toBeTruthy();
        expect(screen.getByTestId('loops-generated').textContent).toBe('0');
        expect(screen.getByText('8:00 AM – 10:00 PM')).toBeTruthy();
    });

    it('says why the Stores could not be loaded', async () => {
        apiClient.get.mockRejectedValue(new APIError('Failed to fetch stores', 500, { error: 'Failed to fetch stores' }));

        render(<ScheduleCalendar />);

        expect((await screen.findByRole('alert')).textContent).toBe('Failed to fetch stores');
        expect(screen.queryByRole('combobox', { name: 'Store' })).toBeNull();
    });

    it('says why the schedule could not be loaded', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE];
            if (endpoint.startsWith('/api/loops/review/')) {
                throw new APIError('Failed to fetch schedule', 500, { error: 'Failed to fetch schedule' });
            }
            return [];
        });

        render(<ScheduleCalendar />);

        expect((await screen.findByRole('alert')).textContent).toBe('Failed to fetch schedule');
    });

    it('says why the overrides could not be loaded', async () => {
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE];
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [] };
            throw new APIError('Failed to fetch schedule overrides', 500, { error: 'Failed to fetch schedule overrides' });
        });

        render(<ScheduleCalendar />);

        expect((await screen.findByRole('alert')).textContent).toBe('Failed to fetch schedule overrides');
    });

    it('moves to the chosen Store\'s tomorrow when the Store changes', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2030-01-15T23:30:00Z'));
        const sydney = { id: 'store-two', name: 'Harbour Store', time_zone: 'Australia/Sydney' };
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/stores') return [STORE, sydney];
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [] };
            return [];
        });

        render(<ScheduleCalendar />);
        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/loops/review/store-one/2030-01-16'));
        fireEvent.change(screen.getByRole('combobox', { name: 'Store' }), { target: { value: 'store-two' } });

        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/loops/review/store-two/2030-01-17'));
        expect(screen.getByTestId('store-time-zone').textContent).toBe('Store time zone: Australia/Sydney');
    });
});

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
            if (endpoint.startsWith('/api/loops/review/')) return { loops: [] };
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
            if (endpoint.startsWith('/api/loops/review/')) return Promise.resolve({ loops: [] });
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

    it('lists overrides in week order, then by start time', async () => {
        serve([
            { ...SAVED, id: 'sched_3', day: 'tuesday', start: '14:00', end: '15:00' },
            { ...SAVED, id: 'sched_2', day: 'monday', start: '12:00', end: '13:00', type: 'forced' },
            { ...SAVED, id: 'sched_1', day: 'tuesday', start: '08:00', end: '09:00' },
        ]);

        render(<ScheduleCalendar />);

        const list = await screen.findByTestId('schedule-overrides');
        await waitFor(() => expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            'Monday 12:00–13:00 · Forced Playlist',
            'Tuesday 08:00–09:00 · Blocked (No Ads)',
            'Tuesday 14:00–15:00 · Blocked (No Ads)',
        ]));
    });

    it('asks for both times before saving an override', async () => {
        serve([]);

        render(<ScheduleCalendar />);
        await screen.findByText('No schedule overrides for this Store.');
        fireEvent.click(screen.getByRole('button', { name: 'Add Override' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save Override' }));

        expect(screen.getByRole('alert').textContent)
            .toBe('Start and End times are required Missing start time. Invalid time range.');
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('closes the override form without saving on Cancel', async () => {
        serve([]);

        render(<ScheduleCalendar />);
        fireEvent.click(await screen.findByRole('button', { name: 'Add Override' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByTestId('modal-schedule-override-form')).toBeNull();
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('keeps the dialog open with the server\'s reason when the save is refused', async () => {
        serve([]);
        apiClient.post.mockRejectedValue(new APIError('end must be after start', 400, { error: 'end must be after start' }));

        render(<ScheduleCalendar />);
        await addOverride({ day: 'monday', start: '11:00', end: '09:00', type: 'blocked' });

        expect(await screen.findByText('end must be after start')).toBeTruthy();
        expect(screen.getByTestId('modal-schedule-override-form')).toBeTruthy();
        expect(screen.getByText('No schedule overrides for this Store.')).toBeTruthy();
    });
});
