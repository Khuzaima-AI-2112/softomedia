import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../../services/api';

const { getSlotAvailability, getPricingConfig } = vi.hoisted(() => ({
    getSlotAvailability: vi.fn(),
    getPricingConfig: vi.fn(),
}));
vi.mock('../../../services/ApiService', () => ({ default: { getSlotAvailability, getPricingConfig } }));

import Step3LoopSlotSelection from './Step3LoopSlotSelection';

const FIRST_HOUR = ['paid', 'paid', 'retailer', 'paid', 'paid', 'internal',
    'paid', 'paid', 'retailer', 'paid', 'paid', 'paid'];

const PRICES = { 8: { price: 15.75, tier: 'low' }, 9: { price: 15.75, tier: 'low' }, 10: { price: 22.5, tier: 'medium' },
    12: { price: 33.75, tier: 'high' } };

const availability = (hours = [8, 9], { statuses = {}, bookingOpen = true } = {}) => ({
    is_closed: false,
    booking_open: bookingOpen,
    booking_cutoff: { date: '2030-01-05', time: '18:00', time_zone: 'America/Toronto' },
    currency: 'USD',
    hours: hours.map(hour => ({
        hour,
        ...PRICES[hour],
        slots: FIRST_HOUR.map((category, position) => ({
            position,
            category,
            status: category === 'paid' ? statuses[`${hour}_${position}`] || 'free' : null,
        })),
    })),
});

const wizardData = {
    selectedStores: ['store_1', 'store_2'],
    storeNames: { store_1: 'Downtown Café', store_2: 'Harbour Café' },
    dateRange: { start: '2030-01-07', end: '2030-01-13' },
    selectedSlots: [],
};

const renderStep = (props = {}) => {
    const updateData = vi.fn();
    const view = render(
        <Step3LoopSlotSelection data={wizardData} updateData={updateData} onNext={vi.fn()} onPrev={vi.fn()} {...props} />,
    );
    return { ...view, updateData };
};

const picked = (hour, position, price, overrides = {}) => ({
    store_id: 'store_1', date: '2030-01-07', hour, position, price, ...overrides,
});

describe('Brand wizard slot grid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSlotAvailability.mockResolvedValue(availability());
        getPricingConfig.mockRejectedValue(new APIError('Forbidden', 403));
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

    it('shows Slots taken by another Brand in red and the Brand’s own as theirs; neither can be picked', async () => {
        getSlotAvailability.mockResolvedValue(availability([8], { statuses: { '8_0': 'taken', '8_1': 'yours' } }));
        const { updateData } = renderStep();

        const eightAm = await screen.findByRole('row', { name: /8:00 AM/ });
        const taken = within(eightAm).getByRole('cell', { name: 'Slot 1 at 8:00 AM: Paid, taken' });
        const yours = within(eightAm).getByRole('cell', { name: 'Slot 2 at 8:00 AM: Paid, yours' });

        expect(taken.className).toMatch(/red/);
        expect(taken.textContent).toBe('taken');
        expect(yours.textContent).toBe('yours');
        expect(within(taken).queryByRole('button')).toBeNull();
        expect(within(yours).queryByRole('button')).toBeNull();
        expect(updateData).not.toHaveBeenCalled();
    });

    it('picks and unpicks a free Paid Slot at its hour’s price', async () => {
        const { updateData, rerender } = renderStep();

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 4 at 8:00 AM' }));
        expect(updateData).toHaveBeenLastCalledWith({ selectedSlots: [picked(8, 3, 15.75)] });

        rerender(<Step3LoopSlotSelection
            data={{ ...wizardData, selectedSlots: [picked(8, 3, 15.75)] }}
            updateData={updateData} onNext={vi.fn()} onPrev={vi.fn()}
        />);
        const pickedButton = screen.getByRole('button', { name: 'Slot 4 at 8:00 AM' });
        expect(pickedButton.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('cell', { name: 'Slot 4 at 8:00 AM: Paid, picked' })).toBeTruthy();
        expect(screen.getByTestId('slot-selection-summary').textContent).toContain('1 Slot');
        expect(screen.getByTestId('slot-selection-summary').textContent).toContain('$15.75');

        fireEvent.click(pickedButton);
        expect(updateData).toHaveBeenLastCalledWith({ selectedSlots: [] });
    });

    it('prices every hour from the availability endpoint, never the pricing configuration (#27)', async () => {
        // A reload on Step 3 leaves no Bookable Inventory loaded; a Brand may not read
        // the pricing configuration, so prices must come from Slot availability.
        getSlotAvailability.mockResolvedValue(availability([8, 10, 12]));
        renderStep();

        expect(within(await screen.findByRole('row', { name: /8:00 AM/ })).getByText('$15.75')).toBeTruthy();
        expect(within(screen.getByRole('row', { name: /10:00 AM/ })).getByText('$22.50')).toBeTruthy();
        expect(within(screen.getByRole('row', { name: /12:00 PM/ })).getByText('$33.75')).toBeTruthy();
        expect(getPricingConfig).not.toHaveBeenCalled();
    });

    it('shows the Booking Cutoff in the Store’s time zone', async () => {
        renderStep();

        expect(await screen.findByTestId('booking-cutoff')).toHaveProperty('textContent',
            'Booking for this date closes at 18:00 on Sat, Jan 5, Store time (America/Toronto).');
    });

    it('does not offer Slots once the Booking Cutoff has passed', async () => {
        getSlotAvailability.mockResolvedValue(availability([8], { bookingOpen: false }));
        renderStep();

        expect(await screen.findByTestId('booking-cutoff')).toHaveProperty('textContent',
            'Booking for this date closed at 18:00 on Sat, Jan 5, Store time (America/Toronto). Choose a later date.');
        expect(screen.queryByRole('button', { name: /^Slot / })).toBeNull();
    });

    it('explains a conflict and shows the Slot as taken after another Brand reserved it first', async () => {
        getSlotAvailability.mockResolvedValue(availability([8], { statuses: { '8_0': 'taken' } }));
        renderStep({
            data: {
                ...wizardData,
                slotConflict: 'Another Brand reserved a Slot you picked moments ago. Choose another Slot and submit again.',
            },
        });

        expect(screen.getByRole('alert').textContent).toMatch(/Choose another Slot/);
        const eightAm = await screen.findByRole('row', { name: /8:00 AM/ });
        expect(within(eightAm).getByRole('cell', { name: 'Slot 1 at 8:00 AM: Paid, taken' })).toBeTruthy();
    });

    it('shows the grid of the chosen Store and date', async () => {
        // Each Store and date opens at a different hour, so the grid shows which one loaded.
        const openingHours = { 'store_1 2030-01-07': 8, 'store_2 2030-01-07': 10, 'store_2 2030-01-09': 12 };
        getSlotAvailability.mockImplementation(async (storeId, date) =>
            availability([openingHours[`${storeId} ${date}`]]));
        renderStep();
        expect(await screen.findByRole('row', { name: /^8:00 AM/ })).toBeTruthy();

        fireEvent.click(screen.getByRole('tab', { name: 'Harbour Café' }));
        expect(await screen.findByRole('row', { name: /^10:00 AM/ })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Harbour Café' }).getAttribute('aria-selected')).toBe('true');

        fireEvent.click(screen.getByTestId('calendar-day-2030-01-09'));
        expect(await screen.findByRole('row', { name: /^12:00 PM/ })).toBeTruthy();
        expect(screen.queryByRole('row', { name: /^10:00 AM/ })).toBeNull();
    });

    it('says the Store is closed on a closed date', async () => {
        getSlotAvailability.mockResolvedValue({ ...availability([]), is_closed: true });

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

    it('continues only once a Slot is picked', async () => {
        const onNext = vi.fn();
        const { rerender } = renderStep({ onNext });
        await screen.findByRole('row', { name: /8:00 AM/ });

        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(true);

        rerender(<Step3LoopSlotSelection
            data={{ ...wizardData, selectedSlots: [picked(8, 0, 15.75)] }}
            updateData={vi.fn()} onNext={onNext} onPrev={vi.fn()}
        />);
        fireEvent.click(screen.getByTestId('step-3-next-btn'));
        expect(onNext).toHaveBeenCalled();
    });
});
