import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { loading: false, permissions: new Set() },
    apiService: {
        getCampaigns: vi.fn(),
        getAdvertisers: vi.fn(),
        createCampaign: vi.fn(),
        deleteCampaign: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ loading: auth.loading, can: (permission) => auth.permissions.has(permission) }),
}));
vi.mock('../../services/ApiService', () => ({ default: apiService }));
// The promotion form has its own tests; here it only matters what the page does with its outcome.
vi.mock('./RetailerPromotionForm', () => ({
    default: ({ onClose, onCreated }) => (
        <div role="dialog" aria-label="Retailer promotion">
            <button onClick={onClose}>Close promotion</button>
            <button onClick={() => onCreated({ name: 'Weekend Deals' })}>Finish promotion</button>
        </div>
    ),
}));

import CampaignManagement from './CampaignManagement';

const SUPER_ADMIN = ['campaigns.view_network', 'campaigns.create', 'campaigns.delete'];
const ADMIN = ['campaigns.view_network', 'campaigns.create'];

const BOLT = { id: 'a1', name: 'Bolt Drinks' };
const CAMPAIGNS = [
    { id: 'c1', name: 'Summer Fizz', advertiser_id: 'a1', status: 'scheduled', created_at: '2026-06-15T12:00:00Z' },
    { id: 'c2', name: 'Winter Fizz', advertiser_id: 'a1', status: 'cancelled', created_at: '2026-09-01T12:00:00Z' },
    { id: 'c3', name: 'Fresh Week', type: 'retailer', status: 'scheduled' },
    { id: 'c4', advertiser_id: 'gone-advertiser' },
    { id: 'c5', name: 'Orphan' },
];

const renderPage = () => render(
    <MemoryRouter initialEntries={['/dashboard/admin/campaigns']}>
        <Routes>
            <Route path="/dashboard/admin/campaigns" element={<CampaignManagement />} />
            <Route path="/dashboard/admin" element={<p>Admin overview</p>} />
        </Routes>
    </MemoryRouter>
);

const renderLoaded = async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Campaign Management' });
};

const rows = () => screen.getAllByRole('row').slice(1);
const rowFor = (name) => rows().find(row => within(row).queryByText(name));

afterEach(() => vi.restoreAllMocks());

describe('CampaignManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.loading = false;
        auth.permissions = new Set(SUPER_ADMIN);
        apiService.getCampaigns.mockResolvedValue(CAMPAIGNS);
        apiService.getAdvertisers.mockResolvedValue([BOLT]);
    });

    it('lists every Campaign with its Advertiser, status and creation date', async () => {
        await renderLoaded();

        expect(screen.getByText('5 campaigns')).toBeTruthy();
        const summer = rowFor('Summer Fizz');
        expect(within(summer).getByText('Bolt Drinks')).toBeTruthy();
        expect(within(summer).getByText('scheduled')).toBeTruthy();
        expect(within(summer).getByText('2026-06-15')).toBeTruthy();
        expect(within(rowFor('Winter Fizz')).getByText('cancelled')).toBeTruthy();
    });

    it('labels a Retailer promotion, and falls back for missing names and Advertisers', async () => {
        await renderLoaded();

        expect(within(rowFor('Fresh Week')).getByText('Retailer promotion')).toBeTruthy();
        const unnamed = rowFor('gone-advertiser');
        expect(within(unnamed).getByRole('button', { name: '—' })).toBeTruthy();
        expect(within(unnamed).getByText('scheduled')).toBeTruthy();
        const orphan = rowFor('Orphan');
        expect(within(orphan).getAllByText('—')).toHaveLength(2);
    });

    it('filters by status and back to all', async () => {
        await renderLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
        expect(screen.getByText('1 campaign')).toBeTruthy();
        expect(rows()).toHaveLength(1);
        expect(rowFor('Winter Fizz')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Scheduled' }));
        expect(screen.getByText('2 campaigns')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'All' }));
        expect(screen.getByText('5 campaigns')).toBeTruthy();
    });

    it('shows a Campaign’s detail and closes it', async () => {
        await renderLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Summer Fizz' }));

        const detail = screen.getByTestId('campaign-detail');
        expect(within(detail).getByRole('heading', { name: 'Summer Fizz' })).toBeTruthy();
        expect(within(detail).getByText('scheduled')).toBeTruthy();

        fireEvent.click(within(detail).getByRole('button', { name: 'Close campaign detail' }));
        expect(screen.queryByTestId('campaign-detail')).toBeNull();
    });

    it('says so when the Campaigns cannot be loaded', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiService.getCampaigns.mockRejectedValue(new APIError('Failed to fetch campaigns', 500, { error: 'Failed to fetch campaigns' }));

        await renderLoaded();

        expect(screen.getByText('Failed to load campaigns. Please try again.')).toBeTruthy();
        expect(screen.getByText('No data available')).toBeTruthy();
    });

    it('copes with empty answers from the server', async () => {
        apiService.getCampaigns.mockResolvedValue(null);
        apiService.getAdvertisers.mockResolvedValue(null);

        await renderLoaded();

        expect(screen.getByText('0 campaigns')).toBeTruthy();
    });

    describe('who sees what', () => {
        it('sends someone without network Campaign access back to the admin overview', async () => {
            auth.permissions = new Set();

            renderPage();

            expect(await screen.findByText('Admin overview')).toBeTruthy();
            expect(apiService.getCampaigns).not.toHaveBeenCalled();
        });

        it('waits for sign-in to finish before deciding', () => {
            auth.loading = true;
            auth.permissions = new Set();

            renderPage();

            expect(screen.queryByText('Admin overview')).toBeNull();
            expect(apiService.getCampaigns).not.toHaveBeenCalled();
        });

        it('lets an Admin create but not delete', async () => {
            auth.permissions = new Set(ADMIN);

            await renderLoaded();

            expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Delete campaign' })).toBeNull();
        });

        it('offers neither create nor promotion to a view-only user', async () => {
            auth.permissions = new Set(['campaigns.view_network']);

            await renderLoaded();

            expect(screen.queryByRole('button', { name: 'Create Campaign' })).toBeNull();
            expect(screen.queryByRole('button', { name: 'Schedule Retailer Promotion' })).toBeNull();
        });
    });

    describe('deleting a Campaign', () => {
        it('does nothing unless confirmed', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            await renderLoaded();

            fireEvent.click(within(rowFor('Summer Fizz')).getByRole('button', { name: 'Delete campaign' }));

            expect(window.confirm).toHaveBeenCalledWith('Permanently delete this campaign? This cannot be undone.');
            expect(apiService.deleteCampaign).not.toHaveBeenCalled();
        });

        it('deletes it, says so and reloads', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteCampaign.mockResolvedValue(null);
            await renderLoaded();

            fireEvent.click(within(rowFor('Summer Fizz')).getByRole('button', { name: 'Delete campaign' }));

            expect(await screen.findByText('Campaign deleted.')).toBeTruthy();
            expect(apiService.deleteCampaign).toHaveBeenCalledWith('c1');
            expect(apiService.getCampaigns).toHaveBeenCalledTimes(2);
        });

        it('shows the server reason when it fails', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteCampaign.mockRejectedValue(new APIError('Campaign store unavailable', 500, { error: 'Campaign store unavailable' }));
            await renderLoaded();

            fireEvent.click(within(rowFor('Summer Fizz')).getByRole('button', { name: 'Delete campaign' }));

            expect(await screen.findByText('Campaign store unavailable')).toBeTruthy();
        });

        it('falls back to a generic reason when the failure has none', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteCampaign.mockRejectedValue(new Error(''));
            await renderLoaded();

            fireEvent.click(within(rowFor('Summer Fizz')).getByRole('button', { name: 'Delete campaign' }));

            expect(await screen.findByText('Failed to delete campaign.')).toBeTruthy();
        });
    });

    describe('creating a Campaign', () => {
        const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
        const submit = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create Campaign' }));

        const openCreate = async () => {
            await renderLoaded();
            fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));
            return screen.getByRole('dialog', { name: 'Create Campaign' });
        };
        const fillValid = () => {
            type(/Campaign Name/, '  Autumn Fizz  ');
            type(/Advertiser/, 'a1');
            type(/Budget/, '1500');
            type(/Start Date/, '2026-10-10');
            type(/End Date/, '2026-10-20');
        };

        it('creates a scheduled Campaign for the chosen Advertiser and reloads', async () => {
            apiService.createCampaign.mockResolvedValue({ id: 'c9' });
            await openCreate();

            fillValid();
            submit();

            expect(await screen.findByText('Campaign "Autumn Fizz" created successfully.')).toBeTruthy();
            expect(apiService.createCampaign).toHaveBeenCalledWith({
                name: 'Autumn Fizz', advertiser_id: 'a1', budget: 1500, start_date: '2026-10-10', end_date: '2026-10-20',
            });
            expect(screen.queryByRole('dialog')).toBeNull();
            expect(apiService.getCampaigns).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['the name is blank', { name: '   ' }, 'Campaign name is required.'],
            ['no Advertiser is chosen', { advertiser: '' }, 'Please select an advertiser.'],
            ['the budget is empty', { budget: '' }, 'Budget must be a number of 0 or greater.'],
            ['the budget is negative', { budget: '-5' }, 'Budget must be a number of 0 or greater.'],
            ['a date is missing', { end: '' }, 'Start and end dates are required.'],
            ['it ends before it starts', { start: '2026-10-21' }, 'Start date must be before end date.'],
        ])('refuses before sending when %s', async (_case, change, message) => {
            await openCreate();
            fillValid();
            if ('name' in change) type(/Campaign Name/, change.name);
            if ('advertiser' in change) type(/Advertiser/, change.advertiser);
            if ('budget' in change) type(/Budget/, change.budget);
            if ('start' in change) type(/Start Date/, change.start);
            if ('end' in change) type(/End Date/, change.end);

            submit();

            expect(screen.getByTestId('campaign-modal-error').textContent).toBe(message);
            expect(apiService.createCampaign).not.toHaveBeenCalled();
        });

        it('warns when there are no Advertisers to choose from', async () => {
            apiService.getAdvertisers.mockResolvedValue([]);
            await openCreate();

            expect(screen.getByText(/No advertisers found/)).toBeTruthy();
        });

        it('locks the form while sending', async () => {
            let finish;
            apiService.createCampaign.mockReturnValue(new Promise(resolve => { finish = resolve; }));
            await openCreate();
            fillValid();

            submit();

            const dialog = screen.getByRole('dialog');
            expect(await within(dialog).findByRole('button', { name: 'Creating…' })).toBeTruthy();
            expect(screen.getByLabelText(/Campaign Name/).disabled).toBe(true);
            fireEvent.click(within(dialog).getByRole('button', { name: 'Close modal' }));
            fireEvent.click(dialog);
            expect(screen.getByRole('dialog')).toBeTruthy();

            finish({});
            await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        });

        it('keeps the form open with the server reason when refused', async () => {
            const reason = 'advertiser_id is required when creating a campaign as admin or superadmin';
            apiService.createCampaign.mockRejectedValue(new APIError(reason, 400, { error: reason }));
            await openCreate();
            fillValid();

            submit();

            expect(await screen.findByText(reason)).toBeTruthy();
            expect(screen.getByRole('dialog')).toBeTruthy();
            expect(screen.getByLabelText(/Campaign Name/).disabled).toBe(false);
        });

        it('falls back to a generic reason when the failure has none', async () => {
            apiService.createCampaign.mockRejectedValue(new Error(''));
            await openCreate();
            fillValid();

            submit();

            expect(await screen.findByText('Failed to create campaign.')).toBeTruthy();
        });

        it('closes from Cancel, the close button, or a click outside, but not a click inside', async () => {
            let dialog = await openCreate();
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('dialog')).toBeNull();

            fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));
            fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
            expect(screen.queryByRole('dialog')).toBeNull();

            fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));
            fireEvent.click(screen.getByLabelText(/Campaign Name/));
            expect(screen.getByRole('dialog')).toBeTruthy();
            dialog = screen.getByRole('dialog');
            fireEvent.click(dialog);
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('starts each time from an empty form', async () => {
            await openCreate();
            type(/Campaign Name/, 'Draft');
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

            expect(screen.getByLabelText(/Campaign Name/).value).toBe('');
        });
    });

    describe('scheduling a Retailer promotion', () => {
        it('reports the scheduled promotion and reloads', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Schedule Retailer Promotion' }));
            fireEvent.click(screen.getByRole('button', { name: 'Finish promotion' }));

            expect(await screen.findByText('Promotion "Weekend Deals" scheduled.')).toBeTruthy();
            expect(screen.queryByRole('dialog', { name: 'Retailer promotion' })).toBeNull();
            expect(apiService.getCampaigns).toHaveBeenCalledTimes(2);
        });

        it('closes without scheduling', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Schedule Retailer Promotion' }));
            fireEvent.click(screen.getByRole('button', { name: 'Close promotion' }));

            expect(screen.queryByRole('dialog', { name: 'Retailer promotion' })).toBeNull();
            expect(apiService.getCampaigns).toHaveBeenCalledTimes(1);
        });
    });
});
