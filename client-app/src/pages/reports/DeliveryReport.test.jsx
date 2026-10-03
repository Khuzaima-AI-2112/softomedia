import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDeliveryReport, auth } = vi.hoisted(() => ({
    getDeliveryReport: vi.fn(),
    auth: { user: null },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: { getDeliveryReport } }));

import DeliveryReport from './DeliveryReport';

const cell = (slots, adPlays) => ({ slots, ad_plays: adPlays });

const REPORT = {
    dayparts: {
        breakfast: { start: 6, end: 11 },
        lunch: { start: 11, end: 15 },
        dinner: { start: 17, end: 21 },
    },
    columns: ['breakfast', 'lunch', 'dinner', 'outside_dayparts'],
    rows: [
        {
            campaign_id: 'muffin', campaign_name: 'Breakfast muffin', is_retailer_promotion: true,
            dayparts: { breakfast: cell(3, 3), lunch: cell(0, 0), dinner: cell(0, 0), outside_dayparts: cell(0, 0) }, total: cell(3, 3),
        },
        {
            campaign_id: 'cola', campaign_name: 'Cola summer', is_retailer_promotion: false,
            dayparts: { breakfast: cell(6, 2), lunch: cell(3, 1), dinner: cell(12, 4), outside_dayparts: cell(3, 1) }, total: cell(24, 8),
        },
    ],
    totals: { breakfast: cell(9, 5), lunch: cell(3, 1), dinner: cell(12, 4), outside_dayparts: cell(3, 1), total: cell(27, 11) },
};

function renderAs(permissions) {
    auth.user = { id: 'user', permissions };
    auth.can = permission => permissions.includes(permission);
    render(
        <MemoryRouter initialEntries={['/dashboard/delivery-report']}>
            <Routes>
                <Route path="/dashboard/delivery-report" element={<DeliveryReport />} />
                <Route path="/dashboard" element={<p>Dashboard home</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

const cellsOf = row => within(row).getAllByRole('cell').map(cell => cell.textContent);

describe('DeliveryReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDeliveryReport.mockResolvedValue(REPORT);
    });

    it('shows Slots then Ad Plays per Campaign and Daypart, with the Daypart hours', async () => {
        renderAs(['delivery_report.view_own']);

        const cola = await screen.findByRole('row', { name: /Cola summer/ });
        expect(cellsOf(cola)).toEqual(['Cola summer', '6', '2', '3', '1', '12', '4', '3', '1', '24', '8']);
        expect(screen.getByRole('columnheader', { name: 'Breakfast 06:00–11:00' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Dinner 17:00–21:00' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Other hours' })).toBeTruthy();
        // Under each Daypart and the Total: Slots, then Ad Plays.
        const subheadings = screen.getAllByRole('columnheader', { name: /^(Slots|Ad Plays)$/ }).map(heading => heading.textContent);
        expect(subheadings).toEqual(Array.from({ length: 5 }, () => ['Slots', 'Ad Plays']).flat());
        expect(cellsOf(screen.getByRole('row', { name: /^Total/ }))).toEqual(['Total', '9', '5', '3', '1', '12', '4', '3', '1', '27', '11']);
    });

    it('marks Retailer promotions', async () => {
        renderAs(['delivery_report.view_network']);

        const muffin = await screen.findByRole('row', { name: /Breakfast muffin/ });
        expect(within(muffin).getByText('Promotion')).toBeTruthy();
        expect(within(screen.getByRole('row', { name: /Cola summer/ })).queryByText('Promotion')).toBeNull();
    });

    it('says when there is no Campaign delivery yet', async () => {
        getDeliveryReport.mockResolvedValue({ ...REPORT, rows: [], totals: { ...REPORT.totals, total: cell(0, 0) } });
        renderAs(['delivery_report.view_own']);

        expect(await screen.findByText('No Campaign delivery recorded yet.')).toBeTruthy();
    });

    it('shows why the report could not load', async () => {
        getDeliveryReport.mockRejectedValue(new Error('Delivery report unavailable'));
        renderAs(['delivery_report.view_own']);

        expect(await screen.findByText('Delivery report unavailable')).toBeTruthy();
    });

    it('sends a user without the report grant back to the dashboard', async () => {
        renderAs(['screens.manage']);

        expect(await screen.findByText('Dashboard home')).toBeTruthy();
        expect(getDeliveryReport).not.toHaveBeenCalled();
    });
});
