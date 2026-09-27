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
});
