import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../../services/api';

const { getSlotAvailability } = vi.hoisted(() => ({ getSlotAvailability: vi.fn() }));
vi.mock('../../../services/ApiService', () => ({ default: { getSlotAvailability } }));
vi.mock('../../../services/PricingService', () => ({ default: {
    init: vi.fn(async () => {}),
    getTrafficTier: () => ({ key: 'medium', multiplier: 1, label: 'Medium' }),
} }));

import Step3LoopSlotSelection from './Step3LoopSlotSelection';

const FIRST_HOUR = ['paid', 'paid', 'retailer', 'paid', 'paid', 'internal',
    'paid', 'paid', 'retailer', 'paid', 'paid', 'paid'];

const availability = (hours = [8, 9]) => ({
    is_closed: false,
    hours: hours.map(hour => ({
        hour,
        slots: FIRST_HOUR.map((category, position) => ({
            position, category, status: category === 'paid' ? 'free' : null,
        })),
    })),
});

const wizardData = {
    selectedStores: ['store_1', 'store_2'],
    storeNames: { store_1: 'Downtown Café', store_2: 'Harbour Café' },
    dateRange: { start: '2030-01-07', end: '2030-01-13' },
};

const renderStep = (props = {}) => render(
    <Step3LoopSlotSelection data={wizardData} updateData={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} {...props} />,
);

describe('Brand wizard slot grid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSlotAvailability.mockResolvedValue(availability());
    });

    it('shows all twelve Slots of each hour for the first Store on the first Campaign date', async () => {
        renderStep();

        const eightAm = await screen.findByRole('row', { name: /8:00 AM/ });
        expect(getSlotAvailability).toHaveBeenCalledWith('store_1', '2030-01-07');
        expect(within(eightAm).getAllByRole('cell')).toHaveLength(12);
        expect(screen.getByRole('row', { name: /9:00 AM/ })).toBeTruthy();
    });

    it('shows free Paid Slots in green and Retailer or Internal Slots in grey, labelled reserved', async () => {
        renderStep();

        const eightAm = await screen.findByRole('row', { name: /8:00 AM/ });
        const free = within(eightAm).getByRole('cell', { name: 'Slot 1 at 8:00 AM: Paid, free' });
        const retailer = within(eightAm).getByRole('cell', { name: 'Slot 3 at 8:00 AM: Retailer, reserved' });
        const internal = within(eightAm).getByRole('cell', { name: 'Slot 6 at 8:00 AM: Internal, reserved' });

        expect(free.className).toMatch(/emerald/);
        for (const reserved of [retailer, internal]) {
            expect(reserved.className).toMatch(/slate/);
            expect(reserved.textContent).toBe('reserved');
        }
        expect(within(eightAm).getAllByText('reserved')).toHaveLength(3);
    });

    it('shows the grid of the chosen Store and date', async () => {
        // Each Store and date opens at a different hour, so the grid shows which one loaded.
        const openingHours = { 'store_1 2030-01-07': 8, 'store_2 2030-01-07': 10, 'store_2 2030-01-09': 12 };
        getSlotAvailability.mockImplementation(async (storeId, date) =>
            availability([openingHours[`${storeId} ${date}`]]));
        renderStep();
        expect(await screen.findByRole('row', { name: '8:00 AM' })).toBeTruthy();

        fireEvent.click(screen.getByRole('tab', { name: 'Harbour Café' }));
        expect(await screen.findByRole('row', { name: '10:00 AM' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Harbour Café' }).getAttribute('aria-selected')).toBe('true');

        fireEvent.click(screen.getByTestId('calendar-day-2030-01-09'));
        expect(await screen.findByRole('row', { name: '12:00 PM' })).toBeTruthy();
        expect(screen.queryByRole('row', { name: '10:00 AM' })).toBeNull();
    });

    it('says the Store is closed on a closed date', async () => {
        getSlotAvailability.mockResolvedValue({ is_closed: true, hours: [] });

        renderStep();

        expect(await screen.findByText('Store is closed on this date')).toBeTruthy();
        expect(screen.queryByRole('row')).toBeNull();
    });

    it('says availability failed to load when the request fails', async () => {
        getSlotAvailability.mockRejectedValue(new APIError('Server error', 500));

        renderStep();

        expect(await screen.findByText('Slot availability could not be loaded')).toBeTruthy();
        expect(screen.queryByRole('row')).toBeNull();
    });

    it('continues to the next step without picking Slots', async () => {
        const onNext = vi.fn();
        renderStep({ onNext });
        await screen.findByRole('row', { name: /8:00 AM/ });

        fireEvent.click(screen.getByTestId('step-3-next-btn'));

        expect(onNext).toHaveBeenCalled();
    });
});
