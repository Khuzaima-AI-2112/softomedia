import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const api = vi.hoisted(() => ({
    getStores: vi.fn(),
    getWeeklyHours: vi.fn(),
    listSpecialHours: vi.fn(),
    updateWeeklyHours: vi.fn(),
    updateSpecialHours: vi.fn(),
}));

vi.mock('../../services/ApiService', () => ({ default: api }));

import BusinessHoursManagement from './BusinessHoursManagement';

const REFUSAL = new APIError(
    'This change would remove hours holding 2 Reservations at Northwind Downtown. Resolve them before changing the hours.',
    409,
    {
        code: 'HOURS_HOLD_RESERVATIONS',
        reservations: [
            { store_id: 'store-one', date: '2030-01-07', hour: 21, position: 0, campaign_id: 'campaign-one' },
            { store_id: 'store-one', date: '2030-01-14', hour: 9, position: 3, campaign_id: 'campaign-two' },
        ],
    },
);

const DOWNTOWN = { id: 'store-one', name: 'Northwind Downtown', city: 'Toronto', time_zone: 'America/Toronto' };
const UPTOWN = { id: 'store-two', name: 'Northwind Uptown', city: 'Toronto' };

// Monday and Sunday are saved; the other days fall back to 08:00–22:00.
const SAVED_WEEK = [
    { store_id: 'store-one', day_of_week: '1', open_time: '09:00', close_time: '21:00', is_closed: false },
    { store_id: 'store-one', day_of_week: 0, open_time: '08:00', close_time: '22:00', is_closed: true },
];
const FESTIVAL = { store_id: 'store-one', date: '2030-01-17', open_time: '10:00', close_time: '14:00', is_closed: false, reason: 'Festival' };
const STOCKTAKE = { store_id: 'store-one', date: '2030-01-24', is_closed: true, reason: '' };

const day = (name) => ({
    open: screen.queryByLabelText(`${name} open`),
    close: screen.queryByLabelText(`${name} close`),
    closed: screen.getByLabelText(`${name} closed`),
});

// 15 January 2030, a Tuesday, at midday; with timers too once the page has loaded.
function fakeClock(toFake = ['Date']) {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake });
    vi.setSystemTime(new Date(2030, 0, 15, 12));
}

async function renderPage() {
    render(<BusinessHoursManagement />);
    await waitFor(() => expect(screen.getByLabelText('Monday open').value).toBe('09:00'));
}

async function openOverrides() {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Future Overrides' }));
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('BusinessHoursManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fakeClock();
        api.getStores.mockResolvedValue([DOWNTOWN, UPTOWN]);
        api.getWeeklyHours.mockResolvedValue(SAVED_WEEK);
        api.listSpecialHours.mockResolvedValue([FESTIVAL, STOCKTAKE]);
    });

    describe('Standard Week', () => {
        it('shows the first Store\'s week, with 08:00–22:00 on the days it has not saved', async () => {
            await renderPage();

            expect(api.getWeeklyHours).toHaveBeenCalledWith('store-one');
            expect(screen.getByRole('button', { name: /Northwind Downtown\s*Toronto · America\/Toronto/ })).toBeTruthy();
            expect(day('Monday').close.value).toBe('21:00');
            expect(day('Tuesday').open.value).toBe('08:00');
            expect(day('Tuesday').close.value).toBe('22:00');
            expect(day('Sunday').closed.checked).toBe(true);
            expect(day('Sunday').open).toBeNull();
            expect(screen.getAllByText('CLOSED ALL DAY')).toHaveLength(1);
        });

        it('saves the edited week, then clears the confirmation', async () => {
            api.updateWeeklyHours.mockResolvedValue([]);
            await renderPage();

            fireEvent.change(day('Monday').open, { target: { value: '07:30' } });
            fireEvent.click(day('Saturday').closed);
            expect(day('Saturday').open).toBeNull();
            fakeClock(['Date', 'setTimeout']);
            fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
            await act(async () => {});

            const week = api.updateWeeklyHours.mock.calls[0][1];
            expect(api.updateWeeklyHours.mock.calls[0][0]).toBe('store-one');
            expect(week).toHaveLength(7);
            expect(week[1]).toMatchObject({ day_of_week: '1', open_time: '07:30', close_time: '21:00' });
            expect(week[6]).toMatchObject({ day_of_week: 6, is_closed: true });
            expect(screen.getByTestId('hours-save-confirmation').textContent).toContain('Weekly schedule saved successfully!');

            await act(async () => { vi.advanceTimersByTime(3000); });
            expect(screen.queryByTestId('hours-save-confirmation')).toBeNull();
        });

        it('shows the server\'s reason when the week is refused', async () => {
            api.updateWeeklyHours.mockRejectedValue(new APIError(
                'Open time (22:00) must be before close time (08:00)', 400,
                { error: 'Open time (22:00) must be before close time (08:00)' },
            ));
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

            expect(await screen.findByText('Failed to save: Open time (22:00) must be before close time (08:00)')).toBeTruthy();
        });

        it('lists the Reservations that block a change to the hours, and keeps them on screen', async () => {
            api.updateWeeklyHours.mockRejectedValue(REFUSAL);
            await renderPage();

            fakeClock(['Date', 'setTimeout']);
            fireEvent.click(screen.getByTestId('btn-hours-save'));
            await act(async () => {});

            const refusal = screen.getByTestId('hours-save-confirmation');
            expect(refusal.textContent).toContain('would remove hours holding 2 Reservations');
            expect(screen.getByText('2030-01-07 21:00, Slot 1 (Campaign campaign-one)')).toBeTruthy();
            expect(screen.getByText('2030-01-14 09:00, Slot 4 (Campaign campaign-two)')).toBeTruthy();

            await act(async () => { vi.advanceTimersByTime(10_000); });
            expect(screen.queryByTestId('hours-save-confirmation')).toBeTruthy();
        });

        it('loads another Store\'s hours when it is chosen', async () => {
            api.getWeeklyHours.mockImplementation(async (storeId) => (storeId === 'store-two'
                ? [{ day_of_week: 1, open_time: '06:00', close_time: '23:00', is_closed: false }]
                : SAVED_WEEK));
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: /Northwind Uptown/ }));

            await waitFor(() => expect(day('Monday').open.value).toBe('06:00'));
            expect(api.listSpecialHours).toHaveBeenCalledWith('store-two');
        });

        it('says when the Stores cannot be loaded', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            api.getStores.mockRejectedValue(new APIError('Failed to fetch stores', 500, { error: 'Failed to fetch stores' }));

            render(<BusinessHoursManagement />);

            expect(await screen.findByText('Failed to load stores. Please refresh the page.')).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Standard Week' })).toBeNull();
        });

        it('says when a Store\'s hours cannot be loaded', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            api.listSpecialHours.mockRejectedValue(new APIError('Failed to fetch special hours list', 500, { error: 'Failed to fetch special hours list' }));

            render(<BusinessHoursManagement />);

            expect(await screen.findByText('Failed to load schedule for this store. Please try again.')).toBeTruthy();
        });
    });

    describe('Future Overrides', () => {
        it('shows the month with each day\'s override or its weekly default', async () => {
            await openOverrides();

            expect(screen.getByText('January 2030')).toBeTruthy();
            const festival = screen.getByRole('button', { name: 'January 17, 2030' });
            expect(within(festival).getByText('Festival')).toBeTruthy();
            expect(within(festival).getByText('10:00 - 14:00')).toBeTruthy();
            expect(within(screen.getByRole('button', { name: 'January 24, 2030' })).getByText('CLOSED')).toBeTruthy();
            expect(within(screen.getByRole('button', { name: 'January 20, 2030' })).getByText('Default: Closed')).toBeTruthy();
            expect(within(screen.getByRole('button', { name: 'January 21, 2030' })).getByText('Default: 09:00-21:00')).toBeTruthy();
            // January 2030 starts on a Tuesday: the Sunday and Monday before it are padding.
            expect(screen.getByRole('button', { name: 'December 30, 2029' }).disabled).toBe(true);
            expect(screen.getByRole('button', { name: 'December 31, 2029' }).disabled).toBe(true);
        });

        it('moves between months', async () => {
            await openOverrides();

            fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
            expect(screen.getByText('February 2030')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'February 28, 2030' })).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
            fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
            expect(screen.getByText('December 2029')).toBeTruthy();
        });

        it('closes the Store for a day, starting from that day\'s weekly hours', async () => {
            api.updateSpecialHours.mockResolvedValue({});
            await openOverrides();

            fireEvent.click(screen.getByRole('button', { name: 'January 21, 2030' }));

            const form = screen.getByTestId('modal-schedule-override-form');
            expect(within(form).getByText(/Monday, January 21, 2030/)).toBeTruthy();
            expect(within(form).getByLabelText('Open Time').value).toBe('09:00');
            expect(within(form).getByLabelText('Close Time').value).toBe('21:00');
            fireEvent.change(within(form).getByLabelText('Reason / Event Name'), { target: { value: 'Renovation' } });
            fireEvent.click(within(form).getByRole('checkbox', { name: 'Store is Closed' }));
            expect(within(form).queryByLabelText('Open Time')).toBeNull();
            fireEvent.click(within(form).getByRole('button', { name: 'Apply Override' }));

            expect(await screen.findByText('Special hours for 2030-01-21 updated!')).toBeTruthy();
            expect(api.updateSpecialHours).toHaveBeenCalledWith('store-one', '2030-01-21', {
                open_time: '09:00', close_time: '21:00', is_closed: true, reason: 'Renovation',
            });
            expect(api.listSpecialHours).toHaveBeenCalledTimes(2);
            expect(screen.queryByTestId('modal-schedule-override-form')).toBeNull();
        });

        it('edits a day\'s existing override', async () => {
            api.updateSpecialHours.mockResolvedValue({});
            await openOverrides();

            fireEvent.click(screen.getByRole('button', { name: 'January 17, 2030' }));

            const form = screen.getByTestId('modal-schedule-override-form');
            expect(within(form).getByLabelText('Reason / Event Name').value).toBe('Festival');
            fireEvent.change(within(form).getByLabelText('Open Time'), { target: { value: '11:00' } });
            fireEvent.change(within(form).getByLabelText('Close Time'), { target: { value: '15:00' } });
            fireEvent.click(within(form).getByRole('button', { name: 'Apply Override' }));

            await waitFor(() => expect(api.updateSpecialHours).toHaveBeenCalledWith('store-one', '2030-01-17', {
                open_time: '11:00', close_time: '15:00', is_closed: false, reason: 'Festival',
            }));
        });

        it('starts a closed day\'s override as closed, and closes the form on Cancel', async () => {
            await openOverrides();

            fireEvent.click(screen.getByRole('button', { name: 'January 24, 2030' }));
            const form = screen.getByTestId('modal-schedule-override-form');
            expect(within(form).getByRole('checkbox', { name: 'Store is Closed' }).checked).toBe(true);
            fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByTestId('modal-schedule-override-form')).toBeNull();
            expect(api.updateSpecialHours).not.toHaveBeenCalled();
        });

        it('keeps the form open with the server\'s reason when the override is refused', async () => {
            api.updateSpecialHours.mockRejectedValue(new APIError(
                'Open time (15:00) must be before close time (10:00)', 400,
                { error: 'Open time (15:00) must be before close time (10:00)' },
            ));
            await openOverrides();

            fireEvent.click(screen.getByRole('button', { name: 'January 22, 2030' }));
            fireEvent.click(screen.getByRole('button', { name: 'Apply Override' }));

            expect(await screen.findByText('Failed to update special hours: Open time (15:00) must be before close time (10:00)')).toBeTruthy();
            expect(screen.getByTestId('modal-schedule-override-form')).toBeTruthy();
        });

        it('closes the form to list the Reservations an override would drop', async () => {
            api.updateSpecialHours.mockRejectedValue(REFUSAL);
            await openOverrides();

            fireEvent.click(screen.getByRole('button', { name: 'January 22, 2030' }));
            fireEvent.click(screen.getByRole('button', { name: 'Apply Override' }));

            expect(await screen.findByText('2030-01-07 21:00, Slot 1 (Campaign campaign-one)')).toBeTruthy();
            expect(screen.queryByTestId('modal-schedule-override-form')).toBeNull();
        });
    });
});
