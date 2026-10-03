import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { apiService } = vi.hoisted(() => ({
    apiService: {
        getStores: vi.fn(),
        getLoopsByDate: vi.fn(),
        generateLoops: vi.fn(),
    },
}));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import LoopManagement from './LoopManagement';

const DOWNTOWN = { id: 's-downtown', retailer_id: 'r-fresh', name: 'Downtown' };
const WESTSIDE = { id: 's-west', retailer_id: 'r-fresh', name: 'Westside' };

// The machine's local noon on 4 October, so "tomorrow" is 5 October in any time zone.
const NOW = new Date(2026, 9, 4, 12, 0, 0);
const TOMORROW = '2026-10-05';
const TODAY = '2026-10-04';

const slot = (fields) => ({ duration: 5, ...fields });
const paid = (assetId) => slot({ asset_id: assetId, allocated_category: 'paid', content_kind: 'campaign' });
const PAID_FALLBACK = slot({ asset_id: 'fallback-house', allocated_category: 'paid', content_kind: 'fallback', is_fallback: true });
const RETAILER = slot({ asset_id: 'promo-1', allocated_category: 'retailer', content_kind: 'media' });
const INTERNAL = slot({ allocated_category: 'internal', content_kind: 'fallback' });

const loopAt = (hour, slots) => ({ id: `loop-${hour}`, hour, date: TOMORROW, store_id: DOWNTOWN.id, slots });
const NINE = loopAt(9, [paid('summer-fizz'), paid('summer-fizz'), PAID_FALLBACK, RETAILER, INTERNAL]);
const TEN = loopAt(10, [paid('bolt'), RETAILER]);

const hoursFrom = (start, end) => ({ start, end, is_closed: false });

function LoopBuilderStandIn() {
    const { id } = useParams();
    return <p>Loop builder for {id}</p>;
}

const renderPage = () => render(
    <MemoryRouter initialEntries={['/dashboard/admin/loops']}>
        <Routes>
            <Route path="/dashboard/admin/loops" element={<LoopManagement />} />
            <Route path="/dashboard/admin/loops/:id" element={<LoopBuilderStandIn />} />
        </Routes>
    </MemoryRouter>
);

const renderLoaded = async () => {
    renderPage();
    await waitFor(() => expect(apiService.getLoopsByDate).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Loading loops...')).toBeNull());
};

const storePicker = () => screen.getByRole('combobox', { name: 'Target store for loop generation' });
const datePicker = () => screen.getByLabelText('Target date for loop generation');
const hour = (label) => screen.getByRole('group', { name: label });
const stat = (label) => screen.getByRole('group', { name: label });
const banner = () => screen.queryByRole('alert');

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('LoopManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        // Render dates as a browser in Montréal would, so a date-only value
        // that slips to the day before shows up.
        const toLocaleDateString = Date.prototype.toLocaleDateString;
        vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locale, options) {
            return toLocaleDateString.call(this, locale, { timeZone: 'America/Toronto', ...options });
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiService.getStores.mockResolvedValue([DOWNTOWN, WESTSIDE]);
        apiService.getLoopsByDate.mockResolvedValue({ loops: [NINE, TEN], business_hours: hoursFrom(9, 11) });
    });

    describe('reviewing a day', () => {
        it("opens on tomorrow's Hourly Loops for the first Store", async () => {
            await renderLoaded();

            expect(storePicker().value).toBe(DOWNTOWN.id);
            expect(datePicker().value).toBe(TOMORROW);
            expect(apiService.getLoopsByDate).toHaveBeenCalledWith(TOMORROW, DOWNTOWN.id);
            expect(screen.getByRole('heading', { name: /Hourly Loop Grid — Monday, October 5, 2026/ })).toBeTruthy();
        });

        it('shows each hour with how many of its twelve Slots are filled', async () => {
            await renderLoaded();

            expect(within(hour('9:00 AM')).getByText('4/12 slots filled')).toBeTruthy();
            expect(within(hour('10:00 AM')).getByText('2/12 slots filled')).toBeTruthy();
            expect(within(stat('Total Hours')).getByText('2')).toBeTruthy();
            expect(within(stat('Loops Generated')).getByText('2')).toBeTruthy();
            expect(banner()).toBeNull();
            expect(screen.queryByText('No Loops Generated')).toBeNull();
        });

        it('reports the Allocation Window and what content fills the Slots', async () => {
            await renderLoaded();

            const report = screen.getByRole('region', { name: 'Allocation Window report' });
            const count = (label) => within(report).getByText(label).nextElementSibling.textContent;
            expect(count('Paid')).toBe('4');
            expect(count('Retailer')).toBe('2');
            expect(count('Internal')).toBe('1');
            expect(count('Campaign content')).toBe('3');
            expect(count('Media content')).toBe('2');
            expect(count('Fallback content')).toBe('2');
        });

        it('opens an hour in the Loop builder', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Edit loop for 10:00 AM' }));

            expect(await screen.findByText('Loop builder for loop-10')).toBeTruthy();
        });

        it("loads another Store's loops when the Admin picks it", async () => {
            await renderLoaded();

            apiService.getLoopsByDate.mockResolvedValue({ loops: [], business_hours: hoursFrom(10, 12) });
            fireEvent.change(storePicker(), { target: { value: WESTSIDE.id } });

            await waitFor(() => expect(apiService.getLoopsByDate).toHaveBeenLastCalledWith(TOMORROW, WESTSIDE.id));
            expect(await screen.findByText('No Loops Generated')).toBeTruthy();
        });

        it('loads the loops for the date the Admin picks, named as that day', async () => {
            await renderLoaded();

            fireEvent.change(datePicker(), { target: { value: '2026-10-07' } });

            await waitFor(() => expect(apiService.getLoopsByDate).toHaveBeenLastCalledWith('2026-10-07', DOWNTOWN.id));
            expect(screen.getByRole('heading', { name: /Wednesday, October 7, 2026/ })).toBeTruthy();
        });

        it('says when the loops cannot be loaded', async () => {
            apiService.getLoopsByDate.mockRejectedValue(new APIError('Failed to fetch loops', 500, { error: 'Failed to fetch loops' }));
            renderPage();

            expect(await screen.findByText('Failed to load loops. Please refresh.')).toBeTruthy();
        });

        it('has nothing to load when there are no Stores', async () => {
            apiService.getStores.mockResolvedValue({ stores: [] });
            renderPage();

            expect(await screen.findByText('No Loops Generated')).toBeTruthy();
            expect(within(storePicker()).getByRole('option', { name: 'No stores found' })).toBeTruthy();
            expect(screen.getByRole('button', { name: `Generate loops for ${TOMORROW}` }).disabled).toBe(true);
            expect(apiService.getLoopsByDate).not.toHaveBeenCalled();
        });

        it('still works when the Store list cannot be loaded', async () => {
            apiService.getStores.mockRejectedValue(new APIError('Failed to fetch stores', 500, {}));
            renderPage();

            expect(await screen.findByText('No Loops Generated')).toBeTruthy();
            expect(apiService.getLoopsByDate).not.toHaveBeenCalled();
        });
    });

    describe('hours without a loop', () => {
        it('warns about every opening hour of a future day that has no loop', async () => {
            apiService.getLoopsByDate.mockResolvedValue({ loops: [], business_hours: hoursFrom(11, 14) });
            await renderLoaded();

            expect(banner().textContent).toContain('3 upcoming hours without a loop');
            expect(banner().textContent).toContain('Screens may play fallback content during: 11:00 AM, 12:00 PM, 1:00 PM');
            expect(within(hour('12:00 PM')).getByText('No loop generated')).toBeTruthy();
            expect(within(stat('Total Hours')).getByText('3')).toBeTruthy();
        });

        it('warns about an opening hour the generated loops do not cover', async () => {
            // The Store's hours were extended after its loops were generated.
            apiService.getLoopsByDate.mockResolvedValue({ loops: [NINE, TEN], business_hours: hoursFrom(9, 12) });
            await renderLoaded();

            expect(banner().textContent).toContain('1 upcoming hour without a loop');
            expect(banner().textContent).toContain('during: 11:00 AM');
            expect(within(hour('11:00 AM')).getByText('No loop generated')).toBeTruthy();
            expect(within(stat('Total Hours')).getByText('3')).toBeTruthy();
        });

        it('only warns about hours still to come today', async () => {
            apiService.getLoopsByDate.mockResolvedValue({ loops: [], business_hours: hoursFrom(10, 14) });
            await renderLoaded();

            fireEvent.change(datePicker(), { target: { value: TODAY } });

            await waitFor(() => expect(banner().textContent).toContain('2 upcoming hours without a loop'));
            expect(banner().textContent).toContain('during: 12:00 PM, 1:00 PM');
        });

        it('assumes 8 AM to 10 PM when the Store has no opening hours', async () => {
            apiService.getLoopsByDate.mockResolvedValue({ loops: [] });
            await renderLoaded();

            expect(within(stat('Total Hours')).getByText('14')).toBeTruthy();
            expect(hour('8:00 AM')).toBeTruthy();
            expect(hour('9:00 PM')).toBeTruthy();
        });

        it('has no hours and no warning on a day the Store is closed', async () => {
            apiService.getLoopsByDate.mockResolvedValue({ loops: [], business_hours: { start: 0, end: 0, is_closed: true } });
            await renderLoaded();

            expect(within(stat('Total Hours')).getByText('0')).toBeTruthy();
            expect(banner()).toBeNull();
        });
    });

    describe('generating the Hourly Loops', () => {
        beforeEach(() => {
            apiService.getLoopsByDate.mockResolvedValueOnce({ loops: [], business_hours: hoursFrom(9, 11) });
        });

        it("generates the Store's loops for the chosen date and shows them", async () => {
            apiService.generateLoops.mockResolvedValue({ message: 'Generated 2 loops' });
            await renderLoaded();
            expect(screen.getByText(`Generate loops for ${TOMORROW} to start scheduling ads.`)).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: `Generate loops for ${TOMORROW}` }));

            expect(await screen.findByText(`Loops generated for ${TOMORROW} at Downtown.`)).toBeTruthy();
            expect(apiService.generateLoops).toHaveBeenCalledWith({
                targetDate: TOMORROW, retailerId: DOWNTOWN.retailer_id, storeId: DOWNTOWN.id,
            });
            expect(within(hour('9:00 AM')).getByText('4/12 slots filled')).toBeTruthy();
            expect(screen.queryByText('No Loops Generated')).toBeNull();
        });

        it('can generate from the empty day as well', async () => {
            apiService.generateLoops.mockResolvedValue({});
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: `Generate Loops for ${TOMORROW}` }));

            expect(await screen.findByText(`Loops generated for ${TOMORROW} at Downtown.`)).toBeTruthy();
        });

        it('shows the generation is in progress', async () => {
            apiService.generateLoops.mockReturnValue(new Promise(() => {}));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: `Generate loops for ${TOMORROW}` }));

            const busy = await screen.findByRole('button', { name: 'Generating loops...' });
            expect(busy.disabled).toBe(true);
        });

        it("says why generation failed in the server's words", async () => {
            apiService.generateLoops.mockRejectedValue(new APIError('Failed to generate loops', 500, { error: 'Failed to generate loops' }));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: `Generate loops for ${TOMORROW}` }));

            expect(await screen.findByText('Failed to generate loops')).toBeTruthy();
            expect(screen.getByText('No Loops Generated')).toBeTruthy();
        });
    });
});
