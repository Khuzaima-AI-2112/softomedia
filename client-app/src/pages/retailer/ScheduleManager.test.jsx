import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient } = vi.hoisted(() => ({ apiClient: { get: vi.fn() } }));
vi.mock('../../services/api', async (importOriginal) => ({ ...await importOriginal(), default: apiClient }));

import { APIError } from '../../services/api';
import ScheduleManager from './ScheduleManager';

const ENTRANCE = {
    id: 'loc-entrance', name: 'Entrance Placement', store_id: 'store-one',
    time_zone: 'America/Toronto', screen_ids: ['screen-1', 'screen-2'],
};
const CHECKOUT = {
    id: 'loc-checkout', name: 'Checkout Placement', store_id: 'store-two',
    time_zone: 'Australia/Sydney', screen_ids: [],
};
// Generated loops are keyed by Store, not Location (LoopGenerationService).
const LOOPS = [
    { id: '2030-01-16_8_store-one', hour: 8, store_id: 'store-one', slots: [] },
    {
        id: '2030-01-16_11_store-one', hour: 11, store_id: 'store-one',
        slots: [{ position: 0, allocated_category: 'paid', asset_name: 'Summer Sale' }],
    },
];

function serve({ locations = [ENTRANCE, CHECKOUT], loops = LOOPS } = {}) {
    apiClient.get.mockImplementation(async (endpoint) => {
        if (endpoint === '/api/locations') return locations;
        if (endpoint.startsWith('/api/loops/review/')) return { loops };
        throw new Error(`Unexpected GET ${endpoint}`);
    });
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('ScheduleManager D-1 Preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 10:00 on 15 January in Toronto; 02:00 on 16 January in Sydney.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2030-01-15T15:00:00Z'));
    });

    it('shows each hour of the Store\'s tomorrow, marking the hours that have a loop', async () => {
        serve();

        render(<ScheduleManager />);

        expect(await screen.findByRole('heading', { name: 'Full-Day Schedule — Wednesday 16 Jan' })).toBeTruthy();
        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/loops/review/store-one/2030-01-16'));
        expect(screen.getByText(/D-1 Preview for/).textContent)
            .toBe('D-1 Preview for Entrance Placement — Wednesday 16 Jan · America/Toronto');
        await waitFor(() => expect(screen.getByTestId('loop-generated-8').textContent).toBe('Generated'));
        expect(screen.getByTestId('loop-generated-11').textContent).toBe('Generated');
        expect(screen.getByTestId('loop-generated-9').textContent).toBe('Not generated');
        expect(screen.getAllByTestId('schedule-slot')).toHaveLength(24);
        expect(within(screen.getAllByTestId('schedule-slot')[0]).getByText('12:00 AM')).toBeTruthy();
        expect(within(screen.getAllByTestId('schedule-slot')[13]).getByText('1:00 PM')).toBeTruthy();
    });

    it('shows the next hour\'s loop in the Store\'s time zone, and goes back to the full day', async () => {
        serve();

        render(<ScheduleManager />);
        await waitFor(() => expect(screen.getByTestId('loop-generated-11').textContent).toBe('Generated'));
        fireEvent.click(screen.getByRole('button', { name: /View Hour Detail/ }));

        expect(screen.getByRole('heading', { name: 'Hourly Loop: 11:00 – 12:00' })).toBeTruthy();
        expect(screen.getByText('Broadcast date Wednesday 16 Jan · America/Toronto')).toBeTruthy();
        expect(within(screen.getByRole('list', { name: '60-Second Loop Breakdown' })).getByText('Summer Sale')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Back to Full Day/ }));
        expect(screen.getByRole('heading', { name: 'Full-Day Schedule — Wednesday 16 Jan' })).toBeTruthy();
    });

    it('says when the next hour has no loop', async () => {
        serve({ loops: [LOOPS[0]] });

        render(<ScheduleManager />);
        await waitFor(() => expect(screen.getByTestId('loop-generated-8').textContent).toBe('Generated'));
        fireEvent.click(screen.getByRole('button', { name: /View Hour Detail/ }));

        expect(screen.getByText('No loop generated for this hour.')).toBeTruthy();
        expect(screen.queryByRole('list', { name: '60-Second Loop Breakdown' })).toBeNull();
    });

    it('previews the chosen Location\'s Store for its own tomorrow', async () => {
        serve();

        render(<ScheduleManager />);
        expect(await screen.findByRole('button', { name: /Entrance Placement\s*2 Screens Active/ })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Checkout Placement\s*0 Screens Active/ }));

        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/loops/review/store-two/2030-01-17'));
        expect(screen.getByRole('heading', { name: 'Full-Day Schedule — Thursday 17 Jan' })).toBeTruthy();
        expect(screen.getByText(/D-1 Preview for/).textContent)
            .toBe('D-1 Preview for Checkout Placement — Thursday 17 Jan · Australia/Sydney');
    });

    it('says why the schedule could not be loaded', async () => {
        apiClient.get.mockImplementation(async (endpoint) => {
            if (endpoint === '/api/locations') return [ENTRANCE];
            throw new APIError('Failed to fetch schedule', 500, { error: 'Failed to fetch schedule' });
        });

        render(<ScheduleManager />);

        expect((await screen.findByRole('alert')).textContent).toBe('Failed to fetch schedule');
        expect(screen.getByTestId('loop-generated-8').textContent).toBe('Not generated');
    });

    it('says why the Locations could not be loaded', async () => {
        apiClient.get.mockRejectedValue(new APIError('Failed to fetch locations', 500, { error: 'Failed to fetch locations' }));

        render(<ScheduleManager />);

        expect((await screen.findByRole('alert')).textContent).toBe('Failed to fetch locations');
    });

    it('says when there is no Location to preview', async () => {
        serve({ locations: [] });

        render(<ScheduleManager />);

        expect(await screen.findByText('No Locations to preview.')).toBeTruthy();
        expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('shows no made-up figures or progress', async () => {
        serve();

        render(<ScheduleManager />);
        await waitFor(() => expect(screen.getByTestId('loop-generated-8').textContent).toBe('Generated'));
        fireEvent.click(screen.getByRole('button', { name: /View Hour Detail/ }));

        expect(screen.queryByText('Safety Lock')).toBeNull();
        expect(screen.queryByText('8.33%')).toBeNull();
        expect(screen.queryByText(/D-1 Generating/)).toBeNull();
    });
});
