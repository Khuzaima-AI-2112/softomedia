import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    getRetailers: vi.fn(),
    getStores: vi.fn(),
    getScreens: vi.fn(),
    createRetailer: vi.fn(),
    updateRetailer: vi.fn(),
    patchRetailer: vi.fn(),
    deleteRetailer: vi.fn(),
    createStore: vi.fn(),
    updateStore: vi.fn(),
    deleteStore: vi.fn(),
}));
const auth = vi.hoisted(() => ({ canManage: true }));

vi.mock('../../services/ApiService', () => ({ default: api }));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ can: () => auth.canManage }),
}));

import RetailerManagement from './RetailerManagement';
import { APIError } from '../../services/api';

const FRESH = {
    id: 'r-fresh', name: 'Fresh Foods', logo: '🥬', contact_email: 'ops@fresh.test',
    contract_start: '2026-01-15', status: 'active',
};
const BOLT = {
    id: 'r-bolt', name: 'Bolt Electronics', logo: '⚡', contact_email: 'hello@bolt.test',
    contract_start: '2025-06-01', status: 'inactive',
};
const EMPTY = {
    id: 'r-empty', name: 'Corner Shop', logo: '🏪', contact_email: 'owner@corner.test',
    contract_start: '2026-03-01', status: 'active',
};
const DOWNTOWN = {
    id: 's-downtown', retailer_id: 'r-fresh', name: 'Downtown', address: '1 Main Street',
    city: 'Montreal', traffic_level: 'high', time_zone: 'America/Toronto',
};
const WESTSIDE = {
    id: 's-west', retailer_id: 'r-fresh', name: 'Westside', address: '9 West Avenue',
    city: 'Laval', traffic_level: 'low', time_zone: 'America/Toronto',
};
const BOLT_STORE = {
    id: 's-bolt', retailer_id: 'r-bolt', name: 'Bolt Central', address: '5 Volt Road',
    city: 'Quebec', time_zone: 'America/Toronto',
};
const SCREENS = [
    { id: 'sc1', retailer_id: 'r-fresh', store_id: 's-downtown', status: 'online' },
    { id: 'sc2', retailer_id: 'r-fresh', store_id: 's-downtown', status: 'offline' },
    { id: 'sc3', retailer_id: 'r-bolt', store_id: 's-bolt', status: 'online' },
];

const rowOf = (name) => screen.getByText(name).closest('tr');
const retailerNames = () =>
    within(screen.getByTestId('retailers-list')).getAllByRole('row').slice(1)
        .map(row => within(row).getAllByRole('cell')[0].querySelector('p').textContent);
const statValue = (label) => screen.getByText(label).nextElementSibling.textContent;
const toast = (text) => screen.findByText(text);

async function renderPage() {
    render(<RetailerManagement />);
    await screen.findByText(FRESH.name);
}

describe('RetailerManagement', () => {
    let confirmSpy;
    beforeEach(() => {
        // Render dates as a browser in Montréal would, so a date-only contract
        // start that slips to the day before shows up.
        const toLocaleDateString = Date.prototype.toLocaleDateString;
        vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locale, options) {
            return toLocaleDateString.call(this, locale, { timeZone: 'America/Toronto', ...options });
        });
        vi.clearAllMocks();
        auth.canManage = true;
        api.getRetailers.mockResolvedValue([FRESH, BOLT, EMPTY]);
        api.getStores.mockResolvedValue([DOWNTOWN, WESTSIDE, BOLT_STORE]);
        api.getScreens.mockResolvedValue(SCREENS);
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    describe('the Retailer list', () => {
        it('shows each Retailer with its Stores, Screens online, contract start and status', async () => {
            await renderPage();

            const cells = within(rowOf(FRESH.name)).getAllByRole('cell').map(cell => cell.textContent);
            expect(cells[0]).toContain('ops@fresh.test');
            expect(cells[1]).toContain('2');
            expect(cells[2]).toContain('1/ 2');
            expect(cells[3]).toBe('Jan 15, 2026');
            expect(cells[4]).toBe('Active');
            expect(within(rowOf(BOLT.name)).getAllByRole('cell')[4].textContent).toBe('Inactive');
        });

        it('totals the network across all Retailers', async () => {
            await renderPage();

            expect(statValue('Total Retailers')).toBe('3');
            expect(screen.getByText('2 active')).toBeTruthy();
            expect(statValue('Total Stores')).toBe('3');
            expect(statValue('Screens Online')).toBe('2');
            expect(screen.getByText('of 3 total')).toBeTruthy();
            expect(statValue('Network Health')).toBe('67%');
        });

        it('reports 0% network health when there are no Screens', async () => {
            api.getScreens.mockResolvedValue([]);
            await renderPage();

            expect(statValue('Network Health')).toBe('0%');
        });

        it('says when the data cannot be loaded', async () => {
            api.getRetailers.mockRejectedValue(new APIError('Network error', 0, null));
            render(<RetailerManagement />);

            expect(await screen.findByText('Failed to load data. Please refresh.')).toBeTruthy();
        });

        it('filters by name or email and by status', async () => {
            await renderPage();

            fireEvent.change(screen.getByPlaceholderText('Search retailers...'), { target: { value: 'BOLT.TEST' } });
            expect(retailerNames()).toEqual([BOLT.name]);
            expect(screen.getByText('Showing 1 of 3 retailers')).toBeTruthy();

            fireEvent.change(screen.getByPlaceholderText('Search retailers...'), { target: { value: '' } });
            fireEvent.change(screen.getByDisplayValue('All statuses'), { target: { value: 'active' } });
            expect(retailerNames()).toEqual([EMPTY.name, FRESH.name]);

            fireEvent.change(screen.getByDisplayValue('Active only'), { target: { value: 'inactive' } });
            fireEvent.change(screen.getByPlaceholderText('Search retailers...'), { target: { value: 'fresh' } });
            expect(screen.getByText('No retailers match your filters')).toBeTruthy();
        });

        it('sorts by name, Stores, Screens and contract start, each way', async () => {
            await renderPage();
            expect(retailerNames()).toEqual([BOLT.name, EMPTY.name, FRESH.name]);

            fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
            expect(retailerNames()).toEqual([FRESH.name, EMPTY.name, BOLT.name]);

            fireEvent.click(screen.getByRole('button', { name: /^Stores/ }));
            expect(retailerNames()).toEqual([EMPTY.name, BOLT.name, FRESH.name]);

            fireEvent.click(screen.getByRole('button', { name: /^Screens/ }));
            expect(retailerNames()).toEqual([EMPTY.name, BOLT.name, FRESH.name]);
            fireEvent.click(screen.getByRole('button', { name: /^Screens/ }));
            expect(retailerNames()).toEqual([FRESH.name, BOLT.name, EMPTY.name]);

            fireEvent.click(screen.getByRole('button', { name: /^Contract start/ }));
            expect(retailerNames()).toEqual([BOLT.name, FRESH.name, EMPTY.name]);
        });

        it('is read-only without organization-management permission', async () => {
            auth.canManage = false;
            await renderPage();

            expect(screen.queryByRole('button', { name: /Add Retailer/ })).toBeNull();
            expect(screen.queryByRole('button', { name: 'Deactivate empty' })).toBeNull();
            expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
            expect(screen.queryByRole('button', { name: `Delete retailer ${FRESH.name}` })).toBeNull();
        });
    });

    describe('adding and editing a Retailer', () => {
        const openAdd = async () => {
            await renderPage();
            fireEvent.click(screen.getByRole('button', { name: /Add Retailer/ }));
            expect(screen.getByRole('heading', { name: 'Add New Retailer' })).toBeTruthy();
        };
        const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

        it('explains each invalid field and re-checks as the Admin types', async () => {
            await openAdd();
            type('Contract Start Date', '');

            fireEvent.click(screen.getByRole('button', { name: 'Create Retailer' }));

            expect(screen.getByText('Company name is required.')).toBeTruthy();
            expect(screen.getByText('Contact email is required.')).toBeTruthy();
            expect(screen.getByText('Contract start date is required.')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Create Retailer' }).disabled).toBe(true);

            type('Company Name', 'Ab');
            expect(screen.getByText('Company name must be at least 3 characters.')).toBeTruthy();
            type('Contact Email', 'not-an-email');
            expect(screen.getByText('Enter a valid email address.')).toBeTruthy();

            type('Company Name', 'Acme Retail');
            type('Contact Email', 'admin@acme.test');
            type('Contract Start Date', '2026-10-01');
            expect(screen.queryByText(/is required|must be|valid email/)).toBeNull();
            expect(screen.getByRole('button', { name: 'Create Retailer' }).disabled).toBe(false);
            expect(api.createRetailer).not.toHaveBeenCalled();
        });

        it('creates an active Retailer, reloads the list and closes the form', async () => {
            api.createRetailer.mockResolvedValue({ id: 'r-acme', name: 'Acme Retail' });
            await openAdd();
            type('Company Name', 'Acme Retail');
            type('Contact Email', 'admin@acme.test');
            type('Contract Start Date', '2026-10-01');
            fireEvent.change(screen.getByDisplayValue('🏪'), { target: { value: '🛒' } });

            fireEvent.click(screen.getByRole('button', { name: 'Create Retailer' }));

            await toast('Retailer "Acme Retail" created.');
            expect(api.createRetailer).toHaveBeenCalledWith({
                name: 'Acme Retail', logo: '🛒', contact_email: 'admin@acme.test',
                contract_start: '2026-10-01', status: 'active',
            });
            expect(api.getRetailers).toHaveBeenCalledTimes(2);
            expect(screen.queryByRole('heading', { name: 'Add New Retailer' })).toBeNull();
        });

        it('keeps the form open with the server\'s reason when saving fails', async () => {
            api.createRetailer.mockRejectedValue(new APIError('A retailer with this name already exists', 409, {
                error: 'A retailer with this name already exists',
            }));
            await openAdd();
            type('Company Name', 'Fresh Foods');
            type('Contact Email', 'ops@fresh.test');

            fireEvent.click(screen.getByRole('button', { name: 'Create Retailer' }));

            expect(await screen.findByText('A retailer with this name already exists')).toBeTruthy();
            expect(screen.getByRole('heading', { name: 'Add New Retailer' })).toBeTruthy();
        });

        it('closes the form on Cancel', async () => {
            await openAdd();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('heading', { name: 'Add New Retailer' })).toBeNull();
        });

        it('edits a Retailer from its current details', async () => {
            api.updateRetailer.mockResolvedValue({});
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: `Edit retailer ${FRESH.name}` }));
            expect(screen.getByRole('heading', { name: 'Edit Retailer' })).toBeTruthy();
            expect(screen.getByLabelText('Company Name').value).toBe(FRESH.name);
            expect(screen.getByLabelText('Contact Email').value).toBe(FRESH.contact_email);
            expect(screen.getByLabelText('Contract Start Date').value).toBe(FRESH.contract_start);

            type('Contact Email', 'new@fresh.test');
            fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

            await toast('Retailer "Fresh Foods" updated.');
            expect(api.updateRetailer).toHaveBeenCalledWith('r-fresh', {
                name: FRESH.name, logo: FRESH.logo, contact_email: 'new@fresh.test', contract_start: FRESH.contract_start,
            });
        });

        it('refuses a company name saved elsewhere that is longer than the form allows', async () => {
            const longName = 'L'.repeat(101);
            api.getRetailers.mockResolvedValue([FRESH, { ...EMPTY, name: longName }]);
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: `Edit retailer ${longName}` }));
            fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

            expect(screen.getByText('Company name must be 100 characters or fewer.')).toBeTruthy();
            expect(api.updateRetailer).not.toHaveBeenCalled();
        });
    });

    describe('activating, deactivating and deleting a Retailer', () => {
        it('deactivates an active Retailer', async () => {
            api.patchRetailer.mockResolvedValue({ status: 'inactive' });
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: `Deactivate ${FRESH.name}` }));

            await toast('Retailer "Fresh Foods" is now inactive.');
            expect(api.patchRetailer).toHaveBeenCalledWith('r-fresh', { status: 'inactive' });
            expect(within(rowOf(FRESH.name)).getAllByRole('cell')[4].textContent).toBe('Inactive');
            expect(screen.getByRole('button', { name: `Activate ${FRESH.name}` })).toBeTruthy();
        });

        it('activates an inactive Retailer and ignores clicks while it is saving', async () => {
            let finish;
            api.patchRetailer.mockReturnValue(new Promise(resolve => { finish = resolve; }));
            await renderPage();

            const button = screen.getByRole('button', { name: `Activate ${BOLT.name}` });
            fireEvent.click(button);
            expect(button.disabled).toBe(true);
            fireEvent.click(button);
            finish(null);

            await toast('Retailer "Bolt Electronics" is now active.');
            expect(api.patchRetailer).toHaveBeenCalledTimes(1);
            expect(within(rowOf(BOLT.name)).getAllByRole('cell')[4].textContent).toBe('Active');
        });

        it('keeps the status and shows the server\'s reason when the change fails', async () => {
            api.patchRetailer.mockRejectedValue(new APIError('Retailer not found', 404, { error: 'Retailer not found' }));
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: `Deactivate ${FRESH.name}` }));

            expect(await screen.findByText('Retailer not found')).toBeTruthy();
            expect(within(rowOf(FRESH.name)).getAllByRole('cell')[4].textContent).toBe('Active');
        });

        it('asks before deleting and does nothing when the Admin declines', async () => {
            confirmSpy.mockReturnValue(false);
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: `Delete retailer ${FRESH.name}` }));

            expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Fresh Foods"? This action cannot be undone.');
            expect(api.deleteRetailer).not.toHaveBeenCalled();
        });

        it('removes a deleted Retailer and closes its Store panel', async () => {
            api.deleteRetailer.mockResolvedValue({});
            await renderPage();
            fireEvent.click(screen.getByText(FRESH.name));
            expect(screen.getByRole('heading', { name: 'Fresh Foods — Stores' })).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: `Delete retailer ${FRESH.name}` }));

            await toast('Retailer "Fresh Foods" deleted.');
            expect(retailerNames()).toEqual([BOLT.name, EMPTY.name]);
            expect(screen.queryByRole('heading', { name: 'Fresh Foods — Stores' })).toBeNull();
        });

        it('keeps the Retailer and shows the server\'s reason when deletion fails', async () => {
            api.deleteRetailer.mockRejectedValue(new APIError('Retailer has stores', 409, { error: 'Retailer has stores' }));
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: `Delete retailer ${FRESH.name}` }));

            expect(await screen.findByText('Retailer has stores')).toBeTruthy();
            expect(retailerNames()).toContain(FRESH.name);
        });
    });

    describe('deactivating Retailers without Stores', () => {
        it('deactivates every active Retailer that has no Stores', async () => {
            api.patchRetailer.mockResolvedValue({});
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: 'Deactivate empty' }));

            await toast('1 retailer(s) deactivated.');
            expect(confirmSpy).toHaveBeenCalledWith('Deactivate 1 retailer(s) with no stores?');
            expect(api.patchRetailer).toHaveBeenCalledTimes(1);
            expect(api.patchRetailer).toHaveBeenCalledWith('r-empty', { status: 'inactive' });
        });

        it('says when there is nothing to deactivate', async () => {
            api.getRetailers.mockResolvedValue([FRESH, BOLT]);
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: 'Deactivate empty' }));

            await toast('No active retailers without stores.');
            expect(confirmSpy).not.toHaveBeenCalled();
        });

        it('does nothing when the Admin declines', async () => {
            confirmSpy.mockReturnValue(false);
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: 'Deactivate empty' }));

            expect(api.patchRetailer).not.toHaveBeenCalled();
        });

        it('says so when some could not be deactivated', async () => {
            api.patchRetailer.mockRejectedValue(new APIError('Database unavailable', 500, { error: 'Database unavailable' }));
            await renderPage();

            fireEvent.click(screen.getByRole('button', { name: 'Deactivate empty' }));

            await toast('Failed to deactivate some retailers. Please try again.');
        });
    });

    describe('a Retailer\'s Stores', () => {
        const openStores = async (retailer) => {
            await renderPage();
            fireEvent.click(screen.getByText(retailer.name));
            return screen.getByTestId('stores-list');
        };

        it('lists the Retailer\'s Stores with traffic, Screens online and city', async () => {
            const list = await openStores(FRESH);

            expect(screen.getByText('2 locations')).toBeTruthy();
            const downtown = within(list).getByText('Downtown').closest('.p-4');
            expect(within(downtown).getByText('1 Main Street')).toBeTruthy();
            expect(within(downtown).getByText('high traffic')).toBeTruthy();
            expect(downtown.textContent).toContain('1/2 screens');
            expect(downtown.textContent).toContain('Montreal');
            expect(within(list).getByText('low traffic')).toBeTruthy();
            expect(within(list).queryByText('Bolt Central')).toBeNull();
        });

        it('counts a single Store in the singular', async () => {
            await openStores(BOLT);

            expect(screen.getByText('1 location')).toBeTruthy();
        });

        it('invites the Admin to add the first Store when there are none', async () => {
            const list = await openStores(EMPTY);

            expect(within(list).getByText('No stores yet')).toBeTruthy();
            fireEvent.click(within(list).getByRole('button', { name: 'Add First Store' }));
            expect(screen.getByRole('heading', { name: 'Add New Store' })).toBeTruthy();
        });

        it('closes the panel from its close button or by choosing the Retailer again', async () => {
            await openStores(FRESH);

            fireEvent.click(screen.getByRole('button', { name: 'Close store panel' }));
            expect(screen.queryByTestId('stores-list')).toBeNull();

            fireEvent.click(screen.getByText(FRESH.name));
            fireEvent.click(screen.getByText(FRESH.name));
            expect(screen.queryByTestId('stores-list')).toBeNull();
        });

        describe('adding a Store', () => {
            const openAddStore = async () => {
                await openStores(FRESH);
                fireEvent.click(screen.getByRole('button', { name: /^add_location_alt\s*Add Store$/ }));
                expect(screen.getByRole('heading', { name: 'Add New Store' })).toBeTruthy();
            };
            const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

            it('explains each invalid field and re-checks as the Admin types', async () => {
                await openAddStore();
                type('Time Zone', ' ');

                fireEvent.click(screen.getByRole('button', { name: 'Add Store' }));

                expect(screen.getByText('Store name is required.')).toBeTruthy();
                expect(screen.getByText('Address is required.')).toBeTruthy();
                expect(screen.getByText('City is required.')).toBeTruthy();
                expect(screen.getByText('Time zone is required.')).toBeTruthy();
                expect(screen.getByRole('button', { name: 'Add Store' }).disabled).toBe(true);

                type('Store Name', 'Ab');
                type('Address', '1 A');
                type('City', 'Montreal 2');
                type('Time Zone', 'Montreal');
                expect(screen.getByText('Store name must be at least 3 characters.')).toBeTruthy();
                expect(screen.getByText('Address must be at least 5 characters.')).toBeTruthy();
                expect(screen.getByText('City must contain only letters, spaces, or hyphens.')).toBeTruthy();
                expect(screen.getByText('Time zone must be an IANA time zone, such as America/Toronto.')).toBeTruthy();
                expect(api.createStore).not.toHaveBeenCalled();
            });

            it('adds the Store to the Retailer with the time zone trimmed', async () => {
                api.createStore.mockResolvedValue({ id: 's-new', name: 'Old Port' });
                await openAddStore();
                expect(screen.getByText(FRESH.name, { selector: 'span' })).toBeTruthy();
                type('Store Name', 'Old Port');
                type('Address', '12 Harbour Road');
                type('City', "Saint-Jean d'Iberville");
                type('Time Zone', ' America/Toronto ');
                type('Traffic Level', 'high');

                fireEvent.click(screen.getByRole('button', { name: 'Add Store' }));

                await toast('Store "Old Port" added to Fresh Foods.');
                expect(api.createStore).toHaveBeenCalledWith({
                    name: 'Old Port', address: '12 Harbour Road', city: "Saint-Jean d'Iberville",
                    traffic_level: 'high', time_zone: 'America/Toronto', retailer_id: 'r-fresh',
                });
                expect(screen.queryByRole('heading', { name: 'Add New Store' })).toBeNull();
            });

            it('keeps the form open with the server\'s reason when saving fails', async () => {
                api.createStore.mockRejectedValue(new APIError('time_zone must be a valid IANA time zone', 400, {
                    error: 'time_zone must be a valid IANA time zone',
                }));
                await openAddStore();
                type('Store Name', 'Old Port');
                type('Address', '12 Harbour Road');
                type('City', 'Montreal');
                type('Time Zone', 'America/Toronto');

                fireEvent.click(screen.getByRole('button', { name: 'Add Store' }));

                expect(await screen.findByText('time_zone must be a valid IANA time zone')).toBeTruthy();
                expect(screen.getByRole('heading', { name: 'Add New Store' })).toBeTruthy();
            });

            it('closes the form on Cancel', async () => {
                await openAddStore();

                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

                expect(screen.queryByRole('heading', { name: 'Add New Store' })).toBeNull();
            });
        });

        describe('editing a Store', () => {
            it('saves changes from the Store\'s current details', async () => {
                api.updateStore.mockResolvedValue({});
                await openStores(FRESH);

                fireEvent.click(screen.getByRole('button', { name: 'Edit store Downtown' }));
                expect(screen.getByRole('heading', { name: 'Edit Store' })).toBeTruthy();
                expect(screen.getByLabelText('Store Name').value).toBe('Downtown');
                expect(screen.getByLabelText('Traffic Level').value).toBe('high');
                fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 Main Street' } });
                fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

                await toast('Store "Downtown" updated.');
                expect(api.updateStore).toHaveBeenCalledWith('s-downtown', {
                    name: 'Downtown', address: '2 Main Street', city: 'Montreal',
                    traffic_level: 'high', time_zone: 'America/Toronto',
                });
            });

            it('refuses details saved elsewhere that are longer than the form allows', async () => {
                api.getStores.mockResolvedValue([{
                    ...DOWNTOWN, name: 'N'.repeat(81), address: 'A'.repeat(121), city: 'C'.repeat(61),
                }]);
                await openStores(FRESH);

                fireEvent.click(screen.getByRole('button', { name: /^Edit store N+$/ }));
                fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

                expect(screen.getByText('Store name must be 80 characters or fewer.')).toBeTruthy();
                expect(screen.getByText('Address must be 120 characters or fewer.')).toBeTruthy();
                expect(screen.getByText('City must be 60 characters or fewer.')).toBeTruthy();
                expect(api.updateStore).not.toHaveBeenCalled();
            });

            it('asks for a time zone the Store never had, with medium traffic by default', async () => {
                await openStores(BOLT);

                fireEvent.click(screen.getByRole('button', { name: 'Edit store Bolt Central' }));
                expect(screen.getByLabelText('Traffic Level').value).toBe('medium');
                fireEvent.change(screen.getByLabelText('Time Zone'), { target: { value: '' } });
                fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

                expect(screen.getByText('Time zone is required.')).toBeTruthy();
                expect(api.updateStore).not.toHaveBeenCalled();
            });
        });

        describe('deleting a Store', () => {
            it('asks first and does nothing when the Admin declines', async () => {
                confirmSpy.mockReturnValue(false);
                await openStores(FRESH);

                fireEvent.click(screen.getByRole('button', { name: 'Delete store Downtown' }));

                expect(confirmSpy).toHaveBeenCalledWith('Delete store "Downtown"? This cannot be undone.');
                expect(api.deleteStore).not.toHaveBeenCalled();
            });

            it('removes the Store once deleted', async () => {
                api.deleteStore.mockResolvedValue({});
                await openStores(FRESH);

                fireEvent.click(screen.getByRole('button', { name: 'Delete store Downtown' }));

                await toast('Store "Downtown" deleted.');
                expect(screen.getByText('1 location')).toBeTruthy();
                expect(within(screen.getByTestId('stores-list')).queryByText('Downtown')).toBeNull();
            });

            it('ignores clicks while a deletion is in flight', async () => {
                let finish;
                api.deleteStore.mockReturnValue(new Promise(resolve => { finish = resolve; }));
                await openStores(FRESH);

                const button = screen.getByRole('button', { name: 'Delete store Downtown' });
                fireEvent.click(button);
                expect(button.disabled).toBe(true);
                fireEvent.click(button);
                finish({});

                await toast('Store "Downtown" deleted.');
                expect(api.deleteStore).toHaveBeenCalledTimes(1);
            });

            it('keeps the Store and shows the server\'s reason when deletion fails', async () => {
                api.deleteStore.mockRejectedValue(new APIError('Store has active Reservations', 409, {
                    error: 'Store has active Reservations',
                }));
                await openStores(FRESH);

                fireEvent.click(screen.getByRole('button', { name: 'Delete store Downtown' }));

                await toast('Store has active Reservations');
                await waitFor(() => expect(screen.getByRole('button', { name: 'Delete store Downtown' }).disabled).toBe(false));
            });
        });
    });
});
