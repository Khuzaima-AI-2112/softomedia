import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBookableInventory } = vi.hoisted(() => ({ getBookableInventory: vi.fn() }));
vi.mock('../../../services/ApiService', () => ({ default: { getBookableInventory } }));
vi.mock('../../../services/PricingService', () => ({ default: { configureBookableInventory: vi.fn() } }));

import Step1LocationScreen from './Step1LocationScreen';

const retailer = { id: 'retailer_1', name: 'Northwind Cafés', logo: null };
const item = (storeId, storeName, screenId, locationId) => ({
    retailer,
    store: { id: storeId, name: storeName, address: '1 Main St' },
    location: { id: locationId, name: 'Entrance' },
    screen: { id: screenId, name: `${screenId} screen`, resolution: '1920x1080', orientation: 'landscape' },
    availability: { status: 'available', bookable: true },
    booking_price: { base: 10, unit: 'CPM' },
});

function Harness({ onNext = vi.fn(), onData = vi.fn() }) {
    const [data, setData] = useState({ selectedStores: [], selectedInventory: [] });
    const updateData = changes => setData(previous => {
        const next = { ...previous, ...changes };
        onData(next);
        return next;
    });
    return <Step1LocationScreen data={data} updateData={updateData} onNext={onNext} />;
}

describe('Brand wizard Store step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getBookableInventory.mockResolvedValue({ items: [
            item('store_1', 'Downtown Café', 'screen_1', 'location_1'),
            item('store_1', 'Downtown Café', 'screen_2', 'location_2'),
            item('store_2', 'Harbour Café', 'screen_3', 'location_3'),
        ] });
    });

    it('offers Stores, not individual Screens', async () => {
        render(<Harness />);

        expect(await screen.findByTestId('store-downtown-café')).toBeTruthy();
        expect(screen.getByText('2 Screens')).toBeTruthy();
        expect(screen.getAllByText('$10.00 CPM')).toHaveLength(2);
        expect(screen.queryByText('Select Screens')).toBeNull();
        expect(screen.queryByTestId('screen-screen_1-screen')).toBeNull();
    });

    it('books every Screen in a chosen Store', async () => {
        const onData = vi.fn();
        render(<Harness onData={onData} />);

        fireEvent.click(await screen.findByTestId('store-downtown-café'));

        const data = onData.mock.lastCall[0];
        expect(data.selectedStores).toEqual(['store_1']);
        expect(data.storeNames).toMatchObject({ store_1: 'Downtown Café', store_2: 'Harbour Café' });
        expect(data.selectedInventory).toEqual([
            { retailer_id: 'retailer_1', store_id: 'store_1', location_id: 'location_1', screen_id: 'screen_1' },
            { retailer_id: 'retailer_1', store_id: 'store_1', location_id: 'location_2', screen_id: 'screen_2' },
        ]);
    });

    it('drops a Store and its Screens when it is chosen again', async () => {
        const onData = vi.fn();
        render(<Harness onData={onData} />);
        const downtown = await screen.findByTestId('store-downtown-café');

        fireEvent.click(downtown);
        fireEvent.click(screen.getByTestId('store-harbour-café'));
        fireEvent.click(downtown);

        const data = onData.mock.lastCall[0];
        expect(data.selectedStores).toEqual(['store_2']);
        expect(data.selectedInventory.map(selection => selection.screen_id)).toEqual(['screen_3']);
    });

    it('continues only once a Store is chosen', async () => {
        const onNext = vi.fn();
        render(<Harness onNext={onNext} />);
        const next = await screen.findByTestId('step-1-next-btn');
        expect(next.disabled).toBe(true);

        fireEvent.click(screen.getByTestId('store-harbour-café'));
        expect(screen.getByText('1 Store')).toBeTruthy();
        fireEvent.click(next);

        expect(onNext).toHaveBeenCalled();
    });
});
