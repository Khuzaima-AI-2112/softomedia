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
            dayparts: { breakfast: 3, lunch: 0, dinner: 0, outside_dayparts: 0 }, total: 3,
        },
        {
            campaign_id: 'cola', campaign_name: 'Cola summer', is_retailer_promotion: false,
            dayparts: { breakfast: 2, lunch: 1, dinner: 4, outside_dayparts: 1 }, total: 8,
        },
    ],
    totals: { breakfast: 5, lunch: 1, dinner: 4, outside_dayparts: 1, total: 11 },
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

    it('shows Proof of Play per Campaign and Daypart, with the Daypart hours', async () => {
        renderAs(['delivery_report.view_own']);

        const cola = await screen.findByRole('row', { name: /Cola summer/ });
        expect(cellsOf(cola)).toEqual(['Cola summer', '2', '1', '4', '1', '8']);
        expect(screen.getByRole('columnheader', { name: 'Breakfast 06:00–11:00' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Dinner 17:00–21:00' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Other hours' })).toBeTruthy();
        expect(cellsOf(screen.getByRole('row', { name: /^Total/ }))).toEqual(['Total', '5', '1', '4', '1', '11']);
    });

    it('marks Retailer promotions', async () => {
        renderAs(['delivery_report.view_network']);

        const muffin = await screen.findByRole('row', { name: /Breakfast muffin/ });
        expect(within(muffin).getByText('Promotion')).toBeTruthy();
        expect(within(screen.getByRole('row', { name: /Cola summer/ })).queryByText('Promotion')).toBeNull();
    });

    it('says when there is no Campaign delivery yet', async () => {
        getDeliveryReport.mockResolvedValue({ ...REPORT, rows: [], totals: { ...REPORT.totals, total: 0 } });
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
