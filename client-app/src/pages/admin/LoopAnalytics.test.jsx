import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('../../services/api', async (importOriginal) => ({
    ...(await importOriginal()),
    default: { get: apiGet },
}));

import { APIError } from '../../services/api';
import LoopAnalytics from './LoopAnalytics';

// The machine's local noon on 4 October, so "today" is 4 October in any time zone.
const NOW = new Date(2026, 9, 4, 12, 0, 0);
const TODAY = '2026-10-04';
const WEEK = ['2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29', '2026-09-28'];

const hourRow = (hour, loopCompletions, integrityScore, status) => ({ hour, loopCompletions, integrityScore, status });
const BY_DATE = {
    '2026-10-04': [
        hourRow(8, 40, 100, 'DELIVERED'),
        hourRow(9, 12, 96.5, 'PARTIAL'),
        hourRow(10, 1500, 90, 'PARTIAL'),
    ],
    '2026-10-03': [hourRow(8, 10, 100, 'DELIVERED')],
    '2026-10-07': [hourRow(8, 7, 100, 'DELIVERED')],
};
const UNAVAILABLE = new APIError('Failed to fetch loop analytics', 500, { error: 'Failed to fetch loop analytics' });

const dateOf = (path) => new URLSearchParams(path.split('?')[1]).get('date');
const answerWith = (byDate) => apiGet.mockImplementation(async (path) => {
    const rows = byDate[dateOf(path)];
    if (rows instanceof Error) throw rows;
    return rows ?? [];
});

const renderLoaded = async () => {
    render(<LoopAnalytics />);
    await waitFor(() => expect(screen.queryByText('Loading analytics…')).toBeNull());
};

const kpi = (label) => screen.getByLabelText(label);
const table = () => screen.getByRole('table');
const bodyRows = () => within(table()).getAllByRole('row').slice(1);
// jsdom's Blob has no text().
const readText = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
});
const cells = (row) => within(row).getAllByRole('cell').map(cell => cell.textContent);

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('LoopAnalytics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        answerWith({ ...BY_DATE, '2026-10-02': UNAVAILABLE });
    });

    describe('the 7-day view', () => {
        it('summarises each of the last seven days, today first', async () => {
            await renderLoaded();

            expect(screen.getByRole('heading', { name: '7-Day Summary' })).toBeTruthy();
            expect(WEEK.every(date => apiGet.mock.calls.some(([path]) => path === `/api/analytics/loops?date=${date}`))).toBe(true);
            expect(bodyRows().map(row => cells(row)[0])).toEqual(WEEK);
            expect(cells(bodyRows()[0])).toEqual([TODAY, '1,552', '95.5%', '2', 'Warning']);
            expect(cells(bodyRows()[1])).toEqual(['2026-10-03', '10', '100.0%', '0', 'Active']);
        });

        it('marks a day with no data, or whose data could not be loaded, as unavailable', async () => {
            await renderLoaded();

            expect(cells(bodyRows()[2])).toEqual(['2026-10-02', '—', '—', '—', 'Unavailable']);
            expect(cells(bodyRows()[3])).toEqual(['2026-10-01', '—', '—', '—', 'Unavailable']);
        });

        it('totals the days that have data', async () => {
            await renderLoaded();

            expect(kpi('Loop Completions').textContent).toBe('1,562');
            expect(kpi('Integrity Score').textContent).toBe('97.8%');
            expect(kpi('Full Delivery').textContent).toBe('1/2');
            expect(kpi('Slot Failures').textContent).toBe('1');
        });
    });

    describe('the day view', () => {
        it("breaks today down by hour", async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Day' }));

            expect(screen.getByRole('heading', { name: `Hourly Breakdown — ${TODAY}` })).toBeTruthy();
            expect(bodyRows().map(cells)).toEqual([
                ['8:00 AM', '40', '100%', '—', 'Active'],
                ['9:00 AM', '12', '96.5%', '—', 'Warning'],
                ['10:00 AM', '1,500', '90%', '—', 'Warning'],
            ]);
            expect(kpi('Loop Completions').textContent).toBe('1,552');
            expect(kpi('Integrity Score').textContent).toBe('95.5%');
            expect(kpi('Full Delivery').textContent).toBe('1/3');
            expect(kpi('Slot Failures').textContent).toBe('2');
        });

        it('charts each hour\'s delivery rate', async () => {
            await renderLoaded();
            fireEvent.click(screen.getByRole('button', { name: 'Day' }));

            const chart = screen.getByRole('list', { name: 'Hourly Delivery Rates' });
            expect(within(chart).getAllByRole('listitem').map(item => item.textContent)).toEqual([
                '8:00 AM100%40cyclesActive',
                '9:00 AM96.5%12cyclesWarning',
                '10:00 AM90%1500cyclesWarning',
            ]);
        });

        it('opens on the day the Admin picks', async () => {
            await renderLoaded();

            fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-07' } });

            expect(await screen.findByRole('heading', { name: 'Hourly Breakdown — 2026-10-07' })).toBeTruthy();
            await waitFor(() => expect(bodyRows().map(cells)).toEqual([['8:00 AM', '7', '100%', '—', 'Active']]));
            expect(apiGet).toHaveBeenCalledWith('/api/analytics/loops?date=2026-10-07');
        });

        it('goes back to the 7-day view', async () => {
            await renderLoaded();
            fireEvent.click(screen.getByRole('button', { name: 'Day' }));

            fireEvent.click(screen.getByRole('button', { name: '7-day' }));

            expect(screen.getByRole('heading', { name: '7-Day Summary' })).toBeTruthy();
            expect(screen.queryByRole('list', { name: 'Hourly Delivery Rates' })).toBeNull();
        });

        it('says when a day has no data', async () => {
            await renderLoaded();

            fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-09' } });

            expect(await screen.findByText('No data for this period.')).toBeTruthy();
            expect(screen.getByText('No delivery data available for 2026-10-09.')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(true);
        });
    });

    it('says when the analytics cannot be loaded, and loads them again on Refresh', async () => {
        answerWith({ ...BY_DATE, [TODAY]: UNAVAILABLE });
        await renderLoaded();
        expect(screen.getByText('Loop analytics could not be loaded.')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();

        answerWith(BY_DATE);
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        await waitFor(() => expect(cells(bodyRows()[0])).toEqual([TODAY, '1,552', '95.5%', '2', 'Warning']));
        expect(screen.queryByText('Loop analytics could not be loaded.')).toBeNull();
    });

    it('shows dashes while loading', () => {
        apiGet.mockReturnValue(new Promise(() => {}));
        render(<LoopAnalytics />);

        expect(kpi('Loop Completions').textContent).toBe('—');
        expect(kpi('Integrity Score').textContent).toBe('—');
        expect(screen.getByText('Loading analytics…')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(true);
    });

    describe('exporting', () => {
        let download;
        beforeEach(() => {
            download = { blob: null, name: null };
            URL.createObjectURL = vi.fn((blob) => { download.blob = blob; return 'blob:analytics'; });
            URL.revokeObjectURL = vi.fn();
            vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { download.name = this.download; });
        });

        it('downloads the 7-day summary as CSV', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

            expect(download.name).toBe(`loop-analytics-${TODAY}.csv`);
            const lines = (await readText(download.blob)).split('\n');
            expect(lines[0]).toBe('Time,Loop Completions,Integrity Score,Slot Failures,Status');
            expect(lines[1]).toBe(`${TODAY},1552,95.5,2,PARTIAL`);
            expect(lines[3]).toBe('2026-10-02,,,,UNAVAILABLE');
            expect(lines).toHaveLength(8);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:analytics');
        });

        it('downloads the hourly breakdown as CSV', async () => {
            await renderLoaded();
            fireEvent.click(screen.getByRole('button', { name: 'Day' }));

            fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

            const lines = (await readText(download.blob)).split('\n');
            expect(lines.slice(1)).toEqual(['8:00 AM,40,100,,DELIVERED', '9:00 AM,12,96.5,,PARTIAL', '10:00 AM,1500,90,,PARTIAL']);
        });
    });
});
