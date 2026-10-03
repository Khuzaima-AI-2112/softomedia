import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { canManage: true },
    apiService: {
        getAdvertisers: vi.fn(),
        getCampaigns: vi.fn(),
        createAdvertiser: vi.fn(),
        updateAdvertiser: vi.fn(),
        patchAdvertiser: vi.fn(),
        deleteAdvertiser: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ can: (permission) => permission === 'organizations.manage' && auth.canManage }),
}));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import AdvertiserManagement from './AdvertiserManagement';

const BOLT = { id: 'a1', name: 'Bolt Drinks', logo: '🥤', industry: 'Food & Beverage', contact_email: 'ads@bolt.test', budget: 2400, status: 'active' };
const SUNNY = { id: 'a2', name: 'Sunny Snacks', logo: '🏢', industry: 'Other', contactemail: 'hi@sunny.test', budget: 1800, status: 'inactive' };
const ZAP = { id: 'a3', name: 'Zap Mobile', logo: '📱', industry: 'Electronics', budget: 0, status: 'suspended' };
const CAMPAIGNS = [
    { id: 'c1', name: 'Summer Fizz', advertiser_id: 'a1', status: 'scheduled', start_date: '2026-07-01', end_date: '2026-07-31' },
    { id: 'c2', name: 'Winter Fizz', advertiser_id: 'a1', status: 'cancelled', start_date: '2026-12-01', end_date: '2026-12-31' },
];

// Campaign routes answer a failure with the underlying error's message.
const UNAVAILABLE = '14 UNAVAILABLE: No connection established';

const rows = () => within(screen.getByTestId('advertisers-list')).getAllByRole('row').slice(1);
const rowFor = (name) => rows().find(row => within(row).queryByText(name));
// The notification whose text is `text`, once it appears.
const findToast = (text) => waitFor(() => {
    const found = screen.getAllByRole('status').find(status => within(status).queryByText(text));
    if (!found) throw new Error(`No notification reads "${text}"`);
    return found;
});
const statCard = (label) => screen.getByRole('group', { name: label });

const renderLoaded = async () => {
    render(<AdvertiserManagement />);
    await screen.findByText('Bolt Drinks');
};

afterEach(() => vi.restoreAllMocks());

describe('AdvertiserManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.canManage = true;
        apiService.getAdvertisers.mockResolvedValue([BOLT, SUNNY, ZAP]);
        apiService.getCampaigns.mockResolvedValue(CAMPAIGNS);
    });

    it('lists each Brand with industry, Campaign count, budget and status', async () => {
        await renderLoaded();

        expect(rows()).toHaveLength(3);
        const bolt = rowFor('Bolt Drinks');
        expect(within(bolt).getByText('Food & Beverage')).toBeTruthy();
        expect(within(bolt).getByText(/2 total/)).toBeTruthy();
        expect(within(bolt).getByText('$2,400.00')).toBeTruthy();
        expect(within(bolt).getByText('Active')).toBeTruthy();
        expect(within(rowFor('Sunny Snacks')).getByText('Inactive')).toBeTruthy();
        expect(within(rowFor('Zap Mobile')).getByText('Suspended')).toBeTruthy();
    });

    it('totals Brands, active ones, Campaigns and budget', async () => {
        await renderLoaded();

        expect(within(statCard('Total Advertisers')).getByText('3')).toBeTruthy();
        expect(within(statCard('Total Advertisers')).getByText('1 active')).toBeTruthy();
        expect(within(statCard('Live Campaigns')).getByText('of 2 total')).toBeTruthy();
        expect(within(statCard('Total Budget')).getByText('$4,200.00')).toBeTruthy();
    });

    it('says so when there are no Brands', async () => {
        apiService.getAdvertisers.mockResolvedValue([]);
        apiService.getCampaigns.mockResolvedValue([]);

        render(<AdvertiserManagement />);

        expect(await screen.findByText('No advertisers found')).toBeTruthy();
    });

    it('tells the user when the list cannot be loaded', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiService.getCampaigns.mockRejectedValue(new APIError(UNAVAILABLE, 500, { error: UNAVAILABLE }));

        render(<AdvertiserManagement />);

        expect(await findToast('Failed to load data. Please refresh.')).toBeTruthy();
    });

    it('is read-only for someone who does not manage organizations', async () => {
        auth.canManage = false;

        await renderLoaded();

        expect(screen.queryByRole('button', { name: /Add Advertiser/ })).toBeNull();
        expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit Bolt Drinks' })).toBeNull();
    });

    describe("a Brand's Campaigns", () => {
        it('opens on the Brand and closes on a second click', async () => {
            await renderLoaded();

            fireEvent.click(within(rowFor('Bolt Drinks')).getByText('Bolt Drinks'));

            expect(screen.getByRole('heading', { name: 'Bolt Drinks - Campaigns' })).toBeTruthy();
            expect(screen.getByText('2 campaigns')).toBeTruthy();
            expect(screen.getByText('Summer Fizz')).toBeTruthy();
            expect(screen.getByText('2026-07-01 → 2026-07-31')).toBeTruthy();

            fireEvent.click(within(rowFor('Bolt Drinks')).getByText('Bolt Drinks'));
            expect(screen.queryByRole('heading', { name: 'Bolt Drinks - Campaigns' })).toBeNull();
        });

        it('says when a Brand has none, and closes from its close button', async () => {
            await renderLoaded();

            fireEvent.click(within(rowFor('Sunny Snacks')).getByText('Sunny Snacks'));
            expect(screen.getByText('No campaigns yet for this advertiser.')).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: 'Close campaign detail' }));
            expect(screen.queryByText('No campaigns yet for this advertiser.')).toBeNull();
        });
    });

    describe('adding a Brand', () => {
        const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

        const openAdd = async () => {
            await renderLoaded();
            fireEvent.click(screen.getByRole('button', { name: /Add Advertiser/ }));
            return screen.getByTestId('modal-advertiser-form');
        };

        it('starts from sensible defaults', async () => {
            await openAdd();

            expect(screen.getByRole('heading', { name: 'Add Advertiser' })).toBeTruthy();
            expect(screen.getByLabelText('Name *').value).toBe('');
            expect(screen.getByLabelText('Industry *').value).toBe('Other');
            expect(screen.getByLabelText('Budget ($)').value).toBe('10000');
        });

        it('creates an active Brand, says so and reloads', async () => {
            apiService.createAdvertiser.mockResolvedValue({ id: 'a9', name: 'Volt Phones' });
            const form = await openAdd();

            fireEvent.click(within(form).getByRole('button', { name: '📱' }));
            type('Name *', 'Volt Phones');
            type('Industry *', 'Electronics');
            type('Contact Email *', 'ads@volt.test');
            type('Budget ($)', '5000');
            fireEvent.click(within(form).getByRole('button', { name: 'Add Advertiser' }));

            expect(await findToast('Advertiser "Volt Phones" created.')).toBeTruthy();
            expect(apiService.createAdvertiser).toHaveBeenCalledWith({
                name: 'Volt Phones', logo: '📱', industry: 'Electronics',
                contact_email: 'ads@volt.test', contactemail: 'ads@volt.test', budget: 5000, status: 'active',
            });
            expect(apiService.getAdvertisers).toHaveBeenCalledTimes(2);
            expect(screen.queryByTestId('modal-advertiser-form')).toBeNull();
        });

        it('names the Brand from the form when the server does not echo it', async () => {
            apiService.createAdvertiser.mockResolvedValue(null);
            const form = await openAdd();

            type('Name *', 'Volt Phones');
            type('Contact Email *', 'ads@volt.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Add Advertiser' }));

            expect(await findToast('Advertiser "Volt Phones" created.')).toBeTruthy();
        });

        it('keeps the form open with the server reason when refused', async () => {
            apiService.createAdvertiser.mockRejectedValue(new APIError('Advertiser already exists', 409, { error: 'Advertiser already exists' }));
            const form = await openAdd();

            type('Name *', 'Bolt Drinks');
            type('Contact Email *', 'ads@bolt.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Add Advertiser' }));

            expect(await within(form).findByText('Advertiser already exists')).toBeTruthy();
            expect(screen.getByTestId('modal-advertiser-form')).toBeTruthy();
        });

        it('falls back to a generic reason when the failure has none', async () => {
            apiService.createAdvertiser.mockRejectedValue(new APIError('', 500, {}));
            const form = await openAdd();

            type('Name *', 'Volt Phones');
            type('Contact Email *', 'ads@volt.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Add Advertiser' }));

            expect(await within(form).findByText('Failed to save advertiser. Please try again.')).toBeTruthy();
        });

        it('closes without saving from Cancel or the close button', async () => {
            const form = await openAdd();
            fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByTestId('modal-advertiser-form')).toBeNull();

            fireEvent.click(screen.getByRole('button', { name: /Add Advertiser/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
            expect(screen.queryByTestId('modal-advertiser-form')).toBeNull();
            expect(apiService.createAdvertiser).not.toHaveBeenCalled();
        });
    });

    describe('editing a Brand', () => {
        it('opens filled with the Brand and saves the changes', async () => {
            apiService.updateAdvertiser.mockResolvedValue({});
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Edit Bolt Drinks' }));

            const form = screen.getByTestId('modal-advertiser-form');
            expect(screen.getByRole('heading', { name: 'Edit Advertiser' })).toBeTruthy();
            expect(screen.getByLabelText('Name *').value).toBe('Bolt Drinks');
            expect(screen.getByLabelText('Industry *').value).toBe('Food & Beverage');
            expect(screen.getByLabelText('Contact Email *').value).toBe('ads@bolt.test');
            expect(screen.getByLabelText('Budget ($)').value).toBe('2400');

            fireEvent.change(screen.getByLabelText('Budget ($)'), { target: { value: '3000' } });
            fireEvent.click(within(form).getByRole('button', { name: 'Save Changes' }));

            expect(await findToast('Advertiser "Bolt Drinks" updated.')).toBeTruthy();
            expect(apiService.updateAdvertiser).toHaveBeenCalledWith('a1', {
                name: 'Bolt Drinks', logo: '🥤', industry: 'Food & Beverage',
                contact_email: 'ads@bolt.test', contactemail: 'ads@bolt.test', budget: 3000,
            });
        });

        it('reads the contact email from either field name, or leaves it blank', async () => {
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Edit Sunny Snacks' }));
            expect(screen.getByLabelText('Contact Email *').value).toBe('hi@sunny.test');
            fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

            fireEvent.click(screen.getByRole('button', { name: 'Edit Zap Mobile' }));
            expect(screen.getByLabelText('Contact Email *').value).toBe('');
        });
    });

    describe('activating and deactivating', () => {
        it('deactivates an active Brand and shows it as inactive', async () => {
            apiService.patchAdvertiser.mockResolvedValue({});
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Deactivate Bolt Drinks' }));

            expect(await findToast('Advertiser "Bolt Drinks" is now inactive.')).toBeTruthy();
            expect(apiService.patchAdvertiser).toHaveBeenCalledWith('a1', { status: 'inactive' });
            expect(within(rowFor('Bolt Drinks')).getByText('Inactive')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Activate Bolt Drinks' })).toBeTruthy();
        });

        it('activates an inactive Brand', async () => {
            apiService.patchAdvertiser.mockResolvedValue({});
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Activate Sunny Snacks' }));

            expect(await findToast('Advertiser "Sunny Snacks" is now active.')).toBeTruthy();
            expect(apiService.patchAdvertiser).toHaveBeenCalledWith('a2', { status: 'active' });
        });

        it('sends one change at a time while the first is in flight', async () => {
            let finish;
            apiService.patchAdvertiser.mockReturnValue(new Promise(resolve => { finish = resolve; }));
            await renderLoaded();

            const button = screen.getByRole('button', { name: 'Deactivate Bolt Drinks' });
            fireEvent.click(button);
            await waitFor(() => expect(button.disabled).toBe(true));
            fireEvent.click(button);

            finish({});
            expect(await findToast('Advertiser "Bolt Drinks" is now inactive.')).toBeTruthy();
            expect(apiService.patchAdvertiser).toHaveBeenCalledTimes(1);
            expect(screen.getByRole('button', { name: 'Activate Bolt Drinks' }).disabled).toBe(false);
        });

        it('keeps the status and says so when the change fails', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            apiService.patchAdvertiser.mockRejectedValue(new APIError('Failed to patch advertiser', 500, { error: 'Failed to patch advertiser' }));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Deactivate Bolt Drinks' }));

            expect(await findToast('Failed to update status. Please try again.')).toBeTruthy();
            expect(within(rowFor('Bolt Drinks')).getByText('Active')).toBeTruthy();
        });
    });

    describe('removing a Brand', () => {
        it('does nothing unless confirmed', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Remove Bolt Drinks' }));

            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('remove "Bolt Drinks"'));
            expect(apiService.deleteAdvertiser).not.toHaveBeenCalled();
            expect(rowFor('Bolt Drinks')).toBeTruthy();
        });

        it('removes it from the list, and closes its Campaigns if open', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteAdvertiser.mockResolvedValue({});
            await renderLoaded();
            fireEvent.click(within(rowFor('Bolt Drinks')).getByText('Bolt Drinks'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove Bolt Drinks' }));

            expect(await findToast('Advertiser "Bolt Drinks" removed.')).toBeTruthy();
            expect(apiService.deleteAdvertiser).toHaveBeenCalledWith('a1');
            expect(rowFor('Bolt Drinks')).toBeUndefined();
            expect(screen.queryByRole('heading', { name: 'Bolt Drinks - Campaigns' })).toBeNull();
        });

        it('leaves another Brand’s open Campaigns alone', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteAdvertiser.mockResolvedValue({});
            await renderLoaded();
            fireEvent.click(within(rowFor('Bolt Drinks')).getByText('Bolt Drinks'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove Sunny Snacks' }));

            expect(await findToast('Advertiser "Sunny Snacks" removed.')).toBeTruthy();
            expect(screen.getByRole('heading', { name: 'Bolt Drinks - Campaigns' })).toBeTruthy();
        });

        it('shows the server reason when refused', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteAdvertiser.mockRejectedValue(new APIError('Advertiser not found', 404, { error: 'Advertiser not found' }));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Remove Bolt Drinks' }));

            expect(await findToast('Advertiser not found')).toBeTruthy();
            expect(rowFor('Bolt Drinks')).toBeTruthy();
        });

        it('falls back to a generic reason when the failure has none', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            apiService.deleteAdvertiser.mockRejectedValue(new APIError('', 500, {}));
            await renderLoaded();

            fireEvent.click(screen.getByRole('button', { name: 'Remove Bolt Drinks' }));

            expect(await findToast('Failed to remove advertiser.')).toBeTruthy();
        });
    });
});
