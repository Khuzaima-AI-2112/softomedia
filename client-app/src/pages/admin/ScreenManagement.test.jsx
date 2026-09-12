import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    getScreens: vi.fn(),
    getRetailers: vi.fn(),
    getStores: vi.fn(),
    getLocations: vi.fn(),
    createScreen: vi.fn(),
    updateScreenStatus: vi.fn(),
    deleteScreen: vi.fn(),
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
});
