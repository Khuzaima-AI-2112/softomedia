import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    getScreens: vi.fn(),
    getRetailers: vi.fn(),
    getStores: vi.fn(),
    getLocations: vi.fn(),
    createScreen: vi.fn(),
    updateScreenStatus: vi.fn(),
    deleteScreen: vi.fn(),
    rotateScreenDeviceKey: vi.fn(),
}));

vi.mock('../../services/ApiService', () => ({ default: api }));

import ScreenManagement from './ScreenManagement';
import { APIError } from '../../services/api';

describe('Technical Operator Screen Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.getScreens.mockResolvedValue([]);
        api.getRetailers.mockResolvedValue([{ id: 'retailer-a', name: 'Retailer A' }]);
        api.getStores.mockResolvedValue([{
            id: 'store-north', retailer_id: 'retailer-a', name: 'North Store', city: 'Montréal',
        }]);
        api.getLocations.mockResolvedValue([{
            id: 'location-entrance', store_id: 'store-north', name: 'Entrance Placement',
        }]);
        api.createScreen.mockResolvedValue({ id: 'screen-entrance-1' });
    });

    it('registers a Screen at the selected Store and Location', async () => {
        render(<ScreenManagement />);
        await screen.findByText('No screens registered. Add one to get started.');

        fireEvent.click(screen.getByRole('button', { name: /Add Screen/i }));
        fireEvent.change(screen.getByLabelText('Screen Hardware ID'), {
            target: { value: 'screen-entrance-1' },
        });
        fireEvent.change(screen.getByLabelText('Retailer'), { target: { value: 'retailer-a' } });
        fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'store-north' } });
        fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-entrance' } });
        fireEvent.click(screen.getByRole('button', { name: 'Register Device' }));

        await waitFor(() => expect(api.createScreen).toHaveBeenCalledWith({
            screen_id: 'screen-entrance-1',
            resolution: '1920x1080',
            user_agent: 'Manual Admin Entry',
            retailer_id: 'retailer-a',
            store_id: 'store-north',
            location_id: 'location-entrance',
        }));
    });

    describe('names the Screen in its confirm dialogs', () => {
        // Seeded Screens carry a name and no screen_id; Screens registered
        // here carry a screen_id and no name.
        const SEEDED = { id: 'demo-screen-north-1', name: 'North Entrance Synthetic Screen', status: 'OFFLINE' };
        const REGISTERED = { id: 'screen-entrance-1', screen_id: 'screen-entrance-1', status: 'OFFLINE' };
        const CASES = [
            ['a seeded Screen by its name', SEEDED, SEEDED.name],
            ['a registered Screen by its hardware ID', REGISTERED, REGISTERED.screen_id],
        ];

        let confirmSpy;
        beforeEach(() => {
            confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        });
        afterEach(() => confirmSpy.mockRestore());

        const rowFor = async (label) => (await screen.findByText(label)).closest('tr');

        it.each(CASES)('asks before deleting %s', async (_, record, label) => {
            api.getScreens.mockResolvedValue([record]);
            render(<ScreenManagement />);

            fireEvent.click(within(await rowFor(label)).getByRole('button', { name: /Delete screen/ }));

            expect(confirmSpy).toHaveBeenCalledWith(`Delete screen "${label}"? This action cannot be undone.`);
            expect(api.deleteScreen).not.toHaveBeenCalled();
        });

        it.each(CASES)('asks before issuing a new device key for %s', async (_, record, label) => {
            api.getScreens.mockResolvedValue([record]);
            render(<ScreenManagement />);

            fireEvent.click(within(await rowFor(label)).getByRole('button', { name: /Issue new device key/ }));

            expect(confirmSpy).toHaveBeenCalledWith(
                `Issue a new device key for "${label}"? Its current Player link will stop working.`
            );
            expect(api.rotateScreenDeviceKey).not.toHaveBeenCalled();
        });

        it('names the Screen in the toast once it is deleted', async () => {
            confirmSpy.mockReturnValue(true);
            api.getScreens.mockResolvedValue([SEEDED]);
            api.deleteScreen.mockResolvedValue({});
            render(<ScreenManagement />);

            fireEvent.click(within(await rowFor(SEEDED.name)).getByRole('button', { name: /Delete screen/ }));

            await screen.findByText(`Screen "${SEEDED.name}" deleted.`);
        });
    });

    describe('changing a Screen\'s status', () => {
        const ACTIVE = { id: 'screen-1', screen_id: 'lobby-1', status: 'active' };
        const INACTIVE = { id: 'screen-2', screen_id: 'lobby-2', status: 'inactive' };

        it('deactivates an active Screen and says so', async () => {
            api.getScreens.mockResolvedValue([ACTIVE]);
            api.updateScreenStatus.mockResolvedValue({});
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Set "lobby-1" inactive' }));

            await screen.findByText('Screen "lobby-1" is now inactive.');
            expect(api.updateScreenStatus).toHaveBeenCalledWith('screen-1', 'inactive');
            expect(screen.getByRole('button', { name: 'Set "lobby-1" active' })).toBeTruthy();
        });

        it('activates an inactive Screen', async () => {
            api.getScreens.mockResolvedValue([INACTIVE]);
            api.updateScreenStatus.mockResolvedValue({});
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Set "lobby-2" active' }));

            await screen.findByText('Screen "lobby-2" is now active.');
            expect(api.updateScreenStatus).toHaveBeenCalledWith('screen-2', 'active');
        });

        it('explains the refusal and keeps the Screen active while Campaigns depend on it', async () => {
            api.getScreens.mockResolvedValue([ACTIVE]);
            api.updateScreenStatus.mockRejectedValue(new APIError(
                'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS', 409, {
                    error: 'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS',
                    message: 'Screen cannot be deactivated while active or upcoming campaigns are assigned to it.',
                },
            ));
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Set "lobby-1" inactive' }));

            await screen.findByText(
                'Cannot set "lobby-1" to inactive — it is part of active or upcoming campaigns. Adjust those campaigns first.'
            );
            expect(screen.queryByText('SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS')).toBeNull();
            expect(screen.getByRole('button', { name: 'Set "lobby-1" inactive' })).toBeTruthy();
        });

        it('shows the server\'s reason for any other failure and restores the status', async () => {
            api.getScreens.mockResolvedValue([ACTIVE]);
            api.updateScreenStatus.mockRejectedValue(new APIError('Screen not found', 404, { error: 'Screen not found' }));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Set "lobby-1" inactive' }));

            await screen.findByText('Screen not found');
            expect(screen.getByRole('button', { name: 'Set "lobby-1" inactive' })).toBeTruthy();
        });

        it('ignores a second click while the change is in flight', async () => {
            api.getScreens.mockResolvedValue([ACTIVE]);
            let finish;
            api.updateScreenStatus.mockReturnValue(new Promise(resolve => { finish = resolve; }));
            render(<ScreenManagement />);

            const button = await screen.findByRole('button', { name: 'Set "lobby-1" inactive' });
            fireEvent.click(button);
            const pending = screen.getByRole('button', { name: 'Set "lobby-1" active' });
            expect(pending.disabled).toBe(true);
            fireEvent.click(pending);
            finish({});

            await screen.findByText('Screen "lobby-1" is now inactive.');
            expect(api.updateScreenStatus).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleting a Screen', () => {
        const RECORD = { id: 'screen-1', screen_id: 'lobby-1', status: 'active' };

        beforeEach(() => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            vi.spyOn(console, 'error').mockImplementation(() => {});
            api.getScreens.mockResolvedValue([RECORD]);
        });
        afterEach(() => vi.restoreAllMocks());

        it('removes the row once the Screen is deleted', async () => {
            api.deleteScreen.mockResolvedValue({});
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Delete screen "lobby-1"' }));

            await screen.findByText('Screen "lobby-1" deleted.');
            expect(screen.getByText('No screens registered. Add one to get started.')).toBeTruthy();
        });

        it('keeps the row and shows the server\'s reason when deletion fails', async () => {
            api.deleteScreen.mockRejectedValue(new APIError('Database unavailable', 500, { error: 'Database unavailable' }));
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Delete screen "lobby-1"' }));

            await screen.findByText('Database unavailable');
            expect(screen.getByText('lobby-1')).toBeTruthy();
        });
    });

    describe('issuing a replacement device key', () => {
        const RECORD = { id: 'screen-1', screen_id: 'lobby-1', status: 'active' };

        beforeEach(() => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            api.getScreens.mockResolvedValue([RECORD]);
        });
        afterEach(() => vi.restoreAllMocks());

        it('shows the new key once with a Player link, until dismissed', async () => {
            api.rotateScreenDeviceKey.mockResolvedValue({ screen_id: 'lobby-1', device_key: 'key-123' });
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Issue new device key for "lobby-1"' }));

            const credential = await screen.findByRole('region', { name: 'Screen device key' });
            expect(within(credential).getByText('key-123')).toBeTruthy();
            expect(within(credential).getByRole('link', { name: 'Open Player' }).getAttribute('href'))
                .toBe(`${window.location.origin}/player?screen_id=lobby-1#key=key-123`);
            expect(screen.getByText('New device key issued for "lobby-1".')).toBeTruthy();

            fireEvent.click(within(credential).getByRole('button', { name: 'Dismiss' }));
            expect(screen.queryByRole('region', { name: 'Screen device key' })).toBeNull();
        });

        it('says so when a new key cannot be issued', async () => {
            api.rotateScreenDeviceKey.mockRejectedValue(new APIError('Device key could not be issued', 503, {
                error: 'Device key could not be issued',
            }));
            render(<ScreenManagement />);

            fireEvent.click(await screen.findByRole('button', { name: 'Issue new device key for "lobby-1"' }));

            await screen.findByText('Device key could not be issued');
            expect(screen.queryByRole('region', { name: 'Screen device key' })).toBeNull();
        });
    });

    describe('registering a Screen', () => {
        const openForm = async () => {
            render(<ScreenManagement />);
            await screen.findByText('No screens registered. Add one to get started.');
            fireEvent.click(screen.getByRole('button', { name: /Add Screen/i }));
            return screen.getByRole('dialog', { name: 'Register New Screen' });
        };

        const fillAndSubmit = () => {
            fireEvent.change(screen.getByLabelText('Screen Hardware ID'), { target: { value: 'lobby-9' } });
            fireEvent.change(screen.getByLabelText('Retailer'), { target: { value: 'retailer-a' } });
            fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'store-north' } });
            fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'location-entrance' } });
            fireEvent.change(screen.getByLabelText('Resolution'), { target: { value: '3840x2160' } });
            fireEvent.click(screen.getByRole('button', { name: 'Register Device' }));
        };

        beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
        afterEach(() => vi.restoreAllMocks());

        it('only offers the chosen Retailer\'s Stores and the chosen Store\'s Locations', async () => {
            api.getStores.mockResolvedValue([
                { id: 'store-north', retailer_id: 'retailer-a', name: 'North Store', city: 'Montréal' },
                { id: 'store-other', retailer_id: 'retailer-b', name: 'Other Store', city: 'Laval' },
            ]);
            api.getLocations.mockResolvedValue([
                { id: 'location-entrance', store_id: 'store-north', name: 'Entrance Placement' },
                { id: 'location-other', store_id: 'store-other', name: 'Other Placement' },
            ]);
            await openForm();

            expect(screen.getByLabelText('Store').disabled).toBe(true);
            expect(screen.getByLabelText('Location').disabled).toBe(true);
            fireEvent.change(screen.getByLabelText('Retailer'), { target: { value: 'retailer-a' } });
            expect(screen.getByRole('option', { name: 'North Store (Montréal)' })).toBeTruthy();
            expect(screen.queryByRole('option', { name: 'Other Store (Laval)' })).toBeNull();

            fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'store-north' } });
            expect(screen.getByRole('option', { name: 'Entrance Placement' })).toBeTruthy();
            expect(screen.queryByRole('option', { name: 'Other Placement' })).toBeNull();
        });

        it('closes the form without registering on Cancel', async () => {
            await openForm();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('dialog')).toBeNull();
            expect(api.createScreen).not.toHaveBeenCalled();
        });

        it('shows the device key issued with a new Screen and lists it', async () => {
            api.createScreen.mockResolvedValue({ id: 'screen-9', screen_id: 'lobby-9', device_key: 'key-999' });
            await openForm();
            api.getScreens.mockResolvedValue([{
                id: 'screen-9', screen_id: 'lobby-9', status: 'active',
                retailer_id: 'retailer-a', store_id: 'store-north', location_id: 'location-entrance',
            }]);

            fillAndSubmit();

            await screen.findByText('Screen registered successfully.');
            expect(screen.queryByRole('dialog')).toBeNull();
            expect(within(screen.getByRole('region', { name: 'Screen device key' })).getByText('key-999')).toBeTruthy();
            const row = screen.getAllByText('lobby-9').find(node => node.closest('tr')).closest('tr');
            expect(within(row).getByText('Entrance Placement — North Store')).toBeTruthy();
        });

        it('shows the server\'s reason when registration is refused', async () => {
            api.createScreen.mockRejectedValue(new APIError('screen_id already registered', 409, {
                error: 'screen_id already registered',
            }));
            await openForm();

            fillAndSubmit();

            expect((await screen.findByRole('alert')).textContent).toBe('screen_id already registered');
        });

        it('tells the operator how long to wait while the database is unavailable', async () => {
            api.createScreen.mockRejectedValue(new APIError(
                'Database temporarily unavailable. Please try again shortly.', 503, {
                    error: 'Database temporarily unavailable. Please try again shortly.',
                    retryAfterSeconds: 12,
                },
            ));
            await openForm();

            fillAndSubmit();

            expect((await screen.findByRole('alert')).textContent)
                .toBe('The database is temporarily unavailable. Please try again in 12 seconds.');
        });
    });

    describe('the Screen list', () => {
        it('names where each Screen is and when it was last seen', async () => {
            api.getRetailers.mockResolvedValue([{ id: 'retailer-a', name: 'Retailer A' }]);
            api.getScreens.mockResolvedValue([
                { id: 's1', screen_id: 'placed', status: 'active', store_id: 'store-north', location_id: 'location-entrance' },
                { id: 's2', screen_id: 'store-only', status: 'active', store_id: 'store-north', retailer_id: 'retailer-a' },
                { id: 's3', screen_id: 'store-no-retailer', status: 'active', store_id: 'store-north' },
                { id: 's4', screen_id: 'legacy', status: 'active', location_id: 'Old Lobby' },
                { id: 's5', screen_id: 'nowhere', status: 'active', last_seen: '2026-09-29T10:00:00Z' },
            ]);
            render(<ScreenManagement />);

            const locationOf = async (label) =>
                within((await screen.findByText(label)).closest('tr')).getAllByRole('cell')[1].textContent;
            expect(await locationOf('placed')).toBe('Entrance Placement — North Store');
            expect(await locationOf('store-only')).toBe('North Store — Retailer A');
            expect(await locationOf('store-no-retailer')).toBe('North Store');
            expect(await locationOf('legacy')).toBe('Old Lobby');
            expect(await locationOf('nowhere')).toBe('Unassigned');

            const lastSeen = (label) => within(screen.getByText(label).closest('tr')).getAllByRole('cell')[2].textContent;
            expect(lastSeen('placed')).toBe('Never');
            expect(lastSeen('nowhere')).toBe(new Date('2026-09-29T10:00:00Z').toLocaleString());
        });

        it('says when the Screens cannot be loaded', async () => {
            api.getScreens.mockRejectedValue(new APIError('Network error', 0, null));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            render(<ScreenManagement />);

            expect((await screen.findByRole('alert')).textContent).toBe('Failed to load screens. Please refresh.');
            vi.restoreAllMocks();
        });
    });
});
