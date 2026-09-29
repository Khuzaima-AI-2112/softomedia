import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    getStores: vi.fn(),
    getLocations: vi.fn(),
    createStore: vi.fn(),
    createLocation: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { role: 'retailer', linked_entity_id: 'retailer-a' } }));

vi.mock('../services/ApiService', () => ({ default: api }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

import LocationManager from './LocationManager';
import { APIError } from '../services/api';

const NORTH = { id: 'store-north', name: 'North Store', time_zone: 'America/Toronto' };
const SOUTH = { id: 'store-south', name: 'South Store', time_zone: 'America/Vancouver' };

describe('LocationManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.user = { role: 'retailer', linked_entity_id: 'retailer-a' };
        api.getStores.mockResolvedValue([NORTH, SOUTH]);
        api.getLocations.mockResolvedValue([{ id: 'loc-1', store_id: 'store-north', name: 'Entrance' }]);
    });

    it('lists each Store with its time zone and Locations', async () => {
        render(<LocationManager />);

        const north = await screen.findByTestId('store-card-store-north');
        expect(within(north).getByText('North Store')).toBeTruthy();
        expect(within(north).getByText('Time zone: America/Toronto')).toBeTruthy();
        expect(within(north).getByText('• Entrance')).toBeTruthy();
        expect(within(screen.getByTestId('store-card-store-south')).getByText('No locations configured.')).toBeTruthy();
    });

    it('says when the Stores cannot be loaded', async () => {
        api.getStores.mockRejectedValue(new APIError('Network error', 0, null));
        render(<LocationManager />);

        expect((await screen.findByRole('status')).textContent).toBe('Unable to load your stores and locations.');
    });

    it('cannot add a Location before there is a Store', async () => {
        api.getStores.mockResolvedValue([]);
        api.getLocations.mockResolvedValue([]);
        render(<LocationManager />);

        expect((await screen.findByRole('button', { name: 'Add Location' })).disabled).toBe(true);
    });

    describe('adding a Store', () => {
        const submitStore = async (name, timeZone) => {
            fireEvent.click(await screen.findByRole('button', { name: 'Add Store' }));
            fireEvent.change(screen.getByLabelText('Store name'), { target: { value: name } });
            fireEvent.change(screen.getByLabelText('IANA time zone'), { target: { value: timeZone } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Store' }));
        };

        it('creates the Store for the Retailer and lists it', async () => {
            api.createStore.mockResolvedValue({ id: 'store-east', name: 'East Store', time_zone: 'America/Halifax' });
            render(<LocationManager />);

            await submitStore('East Store', 'America/Halifax');

            await waitFor(() => expect(api.createStore).toHaveBeenCalledWith({
                name: 'East Store', time_zone: 'America/Halifax', retailer_id: 'retailer-a',
            }));
            expect((await screen.findByRole('status')).textContent)
                .toBe('East Store was created with 08:00–22:00 hours every day.');
            expect(screen.getByTestId('store-card-store-east')).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Create Store' })).toBeNull();
        });

        it('closes the form on Cancel', async () => {
            render(<LocationManager />);

            fireEvent.click(await screen.findByRole('button', { name: 'Add Store' }));
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('button', { name: 'Create Store' })).toBeNull();
        });

        it('refuses when the account is not linked to a Retailer', async () => {
            auth.user = { role: 'retailer' };
            render(<LocationManager />);

            await submitStore('East Store', 'America/Halifax');

            expect((await screen.findByRole('status')).textContent).toBe('Your account is not linked to a retailer.');
            expect(api.createStore).not.toHaveBeenCalled();
        });

        it('shows the server\'s reason when the Store is refused', async () => {
            api.createStore.mockRejectedValue(new APIError('time_zone must be a valid IANA time zone', 400, {
                error: 'time_zone must be a valid IANA time zone',
            }));
            render(<LocationManager />);

            await submitStore('East Store', 'Toronto');

            expect((await screen.findByRole('status')).textContent).toBe('time_zone must be a valid IANA time zone');
        });

        it('falls back to a general message when the server gives no reason', async () => {
            api.createStore.mockRejectedValue(new APIError('Network error', 0, null));
            render(<LocationManager />);

            await submitStore('East Store', 'America/Halifax');

            expect((await screen.findByRole('status')).textContent).toBe('Unable to create the store.');
        });
    });

    describe('adding a Location', () => {
        const openLocationForm = async () => {
            render(<LocationManager />);
            fireEvent.click(await screen.findByRole('button', { name: 'Add Location' }));
            fireEvent.change(screen.getByLabelText('Location name'), { target: { value: 'Checkout' } });
        };

        it('adds the Location to the chosen Store', async () => {
            api.createLocation.mockResolvedValue({ id: 'loc-2', store_id: 'store-south', name: 'Checkout' });
            await openLocationForm();

            expect(screen.getByLabelText('Store').value).toBe('store-north');
            fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'store-south' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));

            await waitFor(() => expect(api.createLocation).toHaveBeenCalledWith({ name: 'Checkout', store_id: 'store-south' }));
            expect((await screen.findByRole('status')).textContent).toBe('Checkout was added to the selected store.');
            expect(within(screen.getByTestId('store-card-store-south')).getByText('• Checkout')).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Create Location' })).toBeNull();
        });

        it('shows the server\'s reason when the Location is refused', async () => {
            api.createLocation.mockRejectedValue(new APIError('name and store_id are required', 400, {
                error: 'name and store_id are required',
            }));
            await openLocationForm();

            fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));

            expect((await screen.findByRole('status')).textContent).toBe('name and store_id are required');
        });

        it('falls back to a general message when the server gives no reason', async () => {
            api.createLocation.mockRejectedValue(new APIError('Network error', 0, null));
            await openLocationForm();

            fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));

            expect((await screen.findByRole('status')).textContent).toBe('Unable to create the location.');
        });

        it('closes the form on Cancel', async () => {
            await openLocationForm();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('button', { name: 'Create Location' })).toBeNull();
        });
    });
});
