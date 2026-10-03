import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { auth, apiService } = vi.hoisted(() => ({
    auth: { user: { role: 'superadmin' }, loading: false },
    apiService: {
        getUsers: vi.fn(),
        getRetailers: vi.fn(),
        getAdvertisers: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));

import UserManagement from './UserManagement';

const ALICE = { id: 'u1', name: 'Alice Martin', email: 'alice@brand.test', role: 'brand', status: 'active' };
const RAJ = { id: 'u2', name: 'Raj Patel', email: 'raj@fresh.test', role: 'retaileradmin', status: 'inactive', organization_id: 'r1' };
const TOM = { id: 'u3', name: 'Tom Ops', email: 'tom@ops.test', role: 'techoperator' };

const renderPage = () => render(
    <MemoryRouter initialEntries={['/dashboard/admin/users']}>
        <Routes>
            <Route path="/dashboard/admin/users" element={<UserManagement />} />
            <Route path="/dashboard/admin" element={<p>Admin overview</p>} />
        </Routes>
    </MemoryRouter>
);

const userRows = () => within(screen.getByTestId('users-list')).getAllByRole('row').slice(1);
const rowFor = (name) => userRows().find(row => within(row).queryByText(name));

afterEach(() => vi.restoreAllMocks());

describe('UserManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.user = { role: 'superadmin' };
        auth.loading = false;
        apiService.getUsers.mockResolvedValue([ALICE, RAJ, TOM]);
        apiService.getRetailers.mockResolvedValue([{ id: 'r1', name: 'FreshMart' }]);
        apiService.getAdvertisers.mockResolvedValue([{ id: 'a1', name: 'Bolt Drinks' }]);
    });

    it('lists every user with their role and status for a Super Administrator', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'User Management' })).toBeTruthy();
        expect(userRows()).toHaveLength(3);
        expect(within(rowFor('Alice Martin')).getByText('Brand')).toBeTruthy();
        expect(within(rowFor('Alice Martin')).getByText('alice@brand.test')).toBeTruthy();
        expect(within(rowFor('Raj Patel')).getByText('Retailer Administrator')).toBeTruthy();
        expect(within(rowFor('Raj Patel')).getByText(/inactive/i)).toBeTruthy();
        expect(within(rowFor('Tom Ops')).getByText('Technical Operator')).toBeTruthy();
        expect(within(rowFor('Tom Ops')).getByText(/active/i)).toBeTruthy();
    });

    it('sends an Admin back to the admin overview without loading users', async () => {
        auth.user = { role: 'admin' };

        renderPage();

        expect(await screen.findByText('Admin overview')).toBeTruthy();
        expect(apiService.getUsers).not.toHaveBeenCalled();
    });

    it('waits for sign-in to finish before deciding who may see the page', () => {
        auth.user = null;
        auth.loading = true;

        renderPage();

        expect(screen.queryByText('Admin overview')).toBeNull();
        expect(screen.queryByRole('heading', { name: 'User Management' })).toBeNull();
        expect(apiService.getUsers).not.toHaveBeenCalled();
    });

    it('says so when the users cannot be loaded', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiService.getUsers.mockRejectedValue(new APIError('Failed to fetch users', 500, { error: 'Failed to fetch users' }));

        renderPage();

        expect(await screen.findByText('Failed to load data. Please try again.')).toBeTruthy();
    });

    it('filters the list by role and back to everyone', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'User Management' });

        fireEvent.click(screen.getByRole('button', { name: 'Retailer Administrator' }));
        expect(userRows().map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Raj Patel']);

        fireEvent.click(screen.getByRole('button', { name: 'Super Administrator' }));
        expect(within(screen.getByTestId('users-list')).queryByText('Raj Patel')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'All' }));
        expect(userRows()).toHaveLength(3);
    });

    describe('creating a user', () => {
        const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

        const openCreate = async () => {
            renderPage();
            fireEvent.click(await screen.findByRole('button', { name: '+ Add User' }));
            return screen.getByTestId('modal-user-form');
        };

        it('creates a Brand user linked to their Advertiser and reloads the list', async () => {
            apiService.createUser.mockResolvedValue({ id: 'u9' });
            const form = await openCreate();

            expect(within(form).getByRole('heading', { name: 'Create User' })).toBeTruthy();
            type('Name', 'Nina Brand');
            type('Email', 'nina@bolt.test');
            type('Linked Advertiser', 'a1');
            fireEvent.click(within(form).getByRole('button', { name: 'Create User' }));

            expect(await screen.findByText('User created successfully.')).toBeTruthy();
            expect(apiService.createUser).toHaveBeenCalledWith({
                name: 'Nina Brand', email: 'nina@bolt.test', role: 'brand', linkedentityid: 'a1',
            });
            expect(screen.queryByTestId('modal-user-form')).toBeNull();
            expect(apiService.getUsers).toHaveBeenCalledTimes(2);
        });

        it('offers Retailers to link a Retailer Administrator, and nothing to link a Technical Operator', async () => {
            await openCreate();

            type('Role', 'retaileradmin');
            const retailers = screen.getByLabelText('Linked Retailer');
            expect(within(retailers).getAllByRole('option').map(o => o.textContent)).toEqual(['— None —', 'FreshMart']);

            type('Role', 'techoperator');
            expect(screen.queryByLabelText(/^Linked/)).toBeNull();
        });

        it('keeps the form open and shows the server reason when the user is rejected', async () => {
            const reason = 'Email must be a valid email address';
            apiService.createUser.mockRejectedValue(new APIError(reason, 400, { error: reason }));
            const form = await openCreate();

            type('Name', 'Nina Brand');
            type('Email', 'nina@bolt.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Create User' }));

            expect(await within(form).findByText(reason)).toBeTruthy();
            expect(screen.queryByText('User created successfully.')).toBeNull();
        });

        it('falls back to a generic message when the failure has none', async () => {
            apiService.createUser.mockRejectedValue(new Error(''));
            const form = await openCreate();

            type('Name', 'Nina Brand');
            type('Email', 'nina@bolt.test');
            fireEvent.click(within(form).getByRole('button', { name: 'Create User' }));

            expect(await within(form).findByText('An error occurred. Please try again.')).toBeTruthy();
        });

        it('closes without saving on Cancel', async () => {
            const form = await openCreate();

            fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByTestId('modal-user-form')).toBeNull();
            expect(apiService.createUser).not.toHaveBeenCalled();
        });
    });

    describe('editing a user', () => {
        it('opens the form filled with the user, linked organization included, and saves changes', async () => {
            apiService.updateUser.mockResolvedValue({});
            renderPage();
            await screen.findByRole('heading', { name: 'User Management' });

            fireEvent.click(within(rowFor('Raj Patel')).getByRole('button', { name: 'Edit user' }));

            const form = screen.getByTestId('modal-user-form');
            expect(within(form).getByRole('heading', { name: 'Edit User' })).toBeTruthy();
            expect(screen.getByLabelText('Name').value).toBe('Raj Patel');
            expect(screen.getByLabelText('Email').value).toBe('raj@fresh.test');
            expect(screen.getByLabelText('Role').value).toBe('retaileradmin');
            expect(screen.getByLabelText('Linked Retailer').value).toBe('r1');

            fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Raj P.' } });
            fireEvent.click(within(form).getByRole('button', { name: 'Save Changes' }));

            expect(await screen.findByText('User updated successfully.')).toBeTruthy();
            expect(apiService.updateUser).toHaveBeenCalledWith('u2', {
                name: 'Raj P.', email: 'raj@fresh.test', role: 'retaileradmin', linkedentityid: 'r1',
            });
        });

        it('fills blanks for a user with no name, email or organization on record', async () => {
            apiService.getUsers.mockResolvedValue([{ id: 'u7', role: 'admin', email: '' }]);
            renderPage();
            await screen.findByRole('heading', { name: 'User Management' });

            fireEvent.click(screen.getByRole('button', { name: 'Edit user' }));

            expect(screen.getByLabelText('Name').value).toBe('');
            expect(screen.getByLabelText('Email').value).toBe('');
            expect(screen.getByLabelText('Role').value).toBe('admin');
        });
    });

    describe('deactivating and reactivating', () => {
        it('deactivates an active user', async () => {
            apiService.updateUser.mockResolvedValue({});
            renderPage();
            await screen.findByRole('heading', { name: 'User Management' });

            fireEvent.click(within(rowFor('Alice Martin')).getByRole('button', { name: 'Deactivate' }));

            expect(await screen.findByText('User deactivated successfully.')).toBeTruthy();
            expect(apiService.updateUser).toHaveBeenCalledWith('u1', { status: 'inactive' });
        });

        it('reactivates an inactive user', async () => {
            apiService.updateUser.mockResolvedValue({});
            renderPage();
            await screen.findByRole('heading', { name: 'User Management' });

            fireEvent.click(within(rowFor('Raj Patel')).getByRole('button', { name: 'Reactivate' }));

            expect(await screen.findByText('User reactivated successfully.')).toBeTruthy();
            expect(apiService.updateUser).toHaveBeenCalledWith('u2', { status: 'active' });
        });

        it('shows the server reason when the change is refused', async () => {
            apiService.updateUser.mockRejectedValue(new APIError('User not found', 404, { error: 'User not found' }));
            renderPage();
            await screen.findByRole('heading', { name: 'User Management' });

            fireEvent.click(within(rowFor('Alice Martin')).getByRole('button', { name: 'Deactivate' }));

            expect(await screen.findByText('User not found')).toBeTruthy();
        });

        it('falls back to a generic message when the failure has none', async () => {
            apiService.updateUser.mockRejectedValue(new Error(''));
            renderPage();
            await screen.findByRole('heading', { name: 'User Management' });

            fireEvent.click(within(rowFor('Alice Martin')).getByRole('button', { name: 'Deactivate' }));

            expect(await screen.findByText('Failed to update user status.')).toBeTruthy();
        });
    });
});
