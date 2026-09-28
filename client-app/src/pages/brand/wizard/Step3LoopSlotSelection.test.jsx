import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// As the server answers: each hour lists where `runLength` free Paid Slots in a row begin.
const availability = (hours = [8, 9], { statuses = {}, bookingOpen = true, runLength = 1 } = {}) => ({
    is_closed: false,
    booking_open: bookingOpen,
    booking_cutoff: { date: '2030-01-05', time: '18:00', time_zone: 'America/Toronto' },
    currency: 'USD',
    run_length: runLength,
    hours: hours.map(hour => {
        const slots = FIRST_HOUR.map((category, position) => ({
            position,
            category,
            status: category === 'paid' ? statuses[`${hour}_${position}`] || 'free' : null,
        }));
        const free = position => slots[position]?.status === 'free';
        const runs = slots.map(({ position }) => position)
            .filter(start => Array.from({ length: runLength }, (_, offset) => start + offset).every(free));
        return { hour, ...PRICES[hour], slots, runs };
    }),
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

afterEach(() => vi.restoreAllMocks());

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
        expect(getSlotAvailability).toHaveBeenCalledWith('store_1', '2030-01-07', 1);
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

    it('with the option off, picks and unpicks a free Paid Slot on the shown date only, at its hour’s price', async () => {
        const single = { ...wizardData, repeatDaily: false };
        const { updateData, rerender } = renderStep({ data: single });

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 4 at 8:00 AM' }));
        expect(updateData).toHaveBeenLastCalledWith(expect.objectContaining({ selectedSlots: [picked(8, 3, 15.75)] }));

        rerender(<Step3LoopSlotSelection
            data={{ ...single, selectedSlots: [picked(8, 3, 15.75)] }}
            updateData={updateData} onNext={vi.fn()} onPrev={vi.fn()}
        />);
        const pickedButton = screen.getByRole('button', { name: 'Slot 4 at 8:00 AM' });
        expect(pickedButton.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('cell', { name: 'Slot 4 at 8:00 AM: Paid, picked' })).toBeTruthy();
        expect(screen.getByTestId('slot-selection-summary').textContent).toContain('1 Slot');
        expect(screen.getByTestId('slot-selection-summary').textContent).toContain('$15.75');

        fireEvent.click(pickedButton);
        expect(updateData).toHaveBeenLastCalledWith(expect.objectContaining({ selectedSlots: [] }));
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

    it('says a Store with no time zone is not taking bookings', async () => {
        const noTimeZone = availability([8], { bookingOpen: false });
        noTimeZone.booking_cutoff.time_zone = null;
        getSlotAvailability.mockResolvedValue(noTimeZone);
        renderStep();

        expect(await screen.findByTestId('booking-cutoff'))
            .toHaveProperty('textContent', 'This Store is not taking bookings yet.');
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
        vi.spyOn(console, 'error').mockImplementation(() => {});

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

describe('Same Slots every day of the Campaign', () => {
    const THREE_DAYS = { start: '2030-01-07', end: '2030-01-09' };

    // Holds the wizard's data as the real wizard does, so picks accumulate across clicks.
    function Wizard({ initial, onNext = vi.fn() }) {
        const [data, setData] = useState({ ...wizardData, dateRange: THREE_DAYS, ...initial });
        return (
            <Step3LoopSlotSelection
                data={data}
                updateData={update => setData(previous => ({ ...previous, ...update }))}
                onNext={onNext}
                onPrev={vi.fn()}
            />
        );
    }

    // Availability per date for store_1; any other Store or date is all free at 8:00 and 9:00.
    const byDate = (days) => getSlotAvailability.mockImplementation(async (storeId, date) =>
        (storeId === 'store_1' && days[date]) || availability());

    const summary = () => screen.getByTestId('slot-selection-summary').textContent;
    const conflicts = () => screen.queryByRole('region', { name: 'Days with unavailable Slots' });

    beforeEach(() => {
        vi.clearAllMocks();
        getSlotAvailability.mockResolvedValue(availability());
    });

    it('is on by default and picks the chosen Slot on every Campaign date, at each day’s price', async () => {
        const pricier = availability();
        pricier.hours[0].price = 20;
        byDate({ '2030-01-09': pricier });
        render(<Wizard />);

        expect((await screen.findByRole('checkbox', { name: 'Same Slots every day of the Campaign' })).checked)
            .toBe(true);
        expect(screen.getAllByTestId(/^calendar-day-/).map(day => day.dataset.testid)).toEqual([
            'calendar-day-2030-01-07', 'calendar-day-2030-01-08', 'calendar-day-2030-01-09',
        ]);
        fireEvent.click(await screen.findByRole('button', { name: 'Slot 4 at 8:00 AM' }));

        expect(summary()).toContain('3 Slots');
        expect(summary()).toContain('$51.50');
        for (const date of ['2030-01-08', '2030-01-09']) {
            fireEvent.click(screen.getByTestId(`calendar-day-${date}`));
            expect((await screen.findByRole('button', { name: 'Slot 4 at 8:00 AM' })).getAttribute('aria-pressed'))
                .toBe('true');
        }
        expect(conflicts()).toBeNull();
        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(false);
    });

    it('lists the days a repeated Slot is taken and holds Continue until the Brand adjusts', async () => {
        byDate({ '2030-01-08': availability([8, 9], { statuses: { '8_3': 'taken' } }) });
        const onNext = vi.fn();
        render(<Wizard onNext={onNext} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 4 at 8:00 AM' }));

        const listed = await screen.findByRole('region', { name: 'Days with unavailable Slots' });
        expect(within(listed).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            expect.stringContaining('Tue, Jan 8: Slot 4 at 8:00 AM, Downtown Café, is taken by another Brand'),
        ]);
        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(true);

        fireEvent.click(within(listed).getByRole('button', { name: 'Drop Slot 4 at 8:00 AM on Tue, Jan 8 at Downtown Café' }));

        expect(conflicts()).toBeNull();
        expect(summary()).toContain('2 Slots');
        fireEvent.click(screen.getByTestId('step-3-next-btn'));
        expect(onNext).toHaveBeenCalled();
    });
    it('lists days a repeated Slot cannot be had for any other reason, never skipping them', async () => {
        // On 8 Jan the Store opens an hour later, so Slot 4 at 9:00 is a Retailer Slot that day.
        const laterOpening = availability([9]);
        laterOpening.hours[0].slots[3] = { position: 3, category: 'retailer', status: null };
        byDate({
            '2030-01-07': availability([8, 9], { bookingOpen: false }),
            '2030-01-08': laterOpening,
            '2030-01-09': { ...availability([]), is_closed: true },
            '2030-01-10': availability([10]),
        });
        render(<Wizard initial={{ dateRange: { start: '2030-01-07', end: '2030-01-11' } }} />);

        fireEvent.click(screen.getByTestId('calendar-day-2030-01-11'));
        fireEvent.click(await screen.findByRole('button', { name: 'Slot 4 at 9:00 AM' }));

        const listed = await screen.findByRole('region', { name: 'Days with unavailable Slots' });
        expect(within(listed).getAllByRole('listitem').map(item => item.textContent.replace(/Drop$/, ''))).toEqual([
            'Mon, Jan 7: Slot 4 at 9:00 AM, Downtown Café, is past the Booking Cutoff.',
            'Tue, Jan 8: Slot 4 at 9:00 AM, Downtown Café, is reserved for the Retailer or Softomedia that day.',
            'Wed, Jan 9: Slot 4 at 9:00 AM, Downtown Café, falls on a day the Store is closed.',
            'Thu, Jan 10: Slot 4 at 9:00 AM, Downtown Café, is outside the Store’s opening hours.',
        ]);
        expect(summary()).toContain('5 Slots');
        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(true);

        fireEvent.click(within(listed).getByRole('button', { name: 'Drop all' }));

        expect(conflicts()).toBeNull();
        expect(summary()).toContain('1 Slot');
        expect(summary()).toContain('$15.75');
        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(false);
    });

    it('lists a day whose availability could not be checked', async () => {
        getSlotAvailability.mockImplementation(async (storeId, date) => {
            if (date === '2030-01-09') throw new APIError('Server error', 500);
            return availability();
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<Wizard />);

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' }));

        expect(within(await screen.findByRole('region', { name: 'Days with unavailable Slots' }))
            .getByRole('listitem').textContent)
            .toContain('Wed, Jan 9: Slot 1 at 8:00 AM, Downtown Café, could not be checked. Try again later.');
        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(true);
    });

    it('unpicks the Slot on every date, and with the option off picks it on the shown date only', async () => {
        render(<Wizard />);

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' }));
        expect(summary()).toContain('3 Slots');
        fireEvent.click(screen.getByRole('button', { name: 'Slot 1 at 8:00 AM' }));
        expect(summary()).toContain('0 Slots');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Same Slots every day of the Campaign' }));
        fireEvent.click(screen.getByRole('button', { name: 'Slot 1 at 8:00 AM' }));
        expect(summary()).toContain('1 Slot');
        fireEvent.click(screen.getByTestId('calendar-day-2030-01-08'));
        expect((await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' })).getAttribute('aria-pressed'))
            .toBe('false');
    });

    it('turned back on, repeats every Slot already picked onto every Campaign date', async () => {
        render(<Wizard initial={{ repeatDaily: false }} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' }));
        fireEvent.click(screen.getByTestId('calendar-day-2030-01-08'));
        fireEvent.click(await screen.findByRole('button', { name: 'Slot 2 at 9:00 AM' }));
        expect(summary()).toContain('2 Slots');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Same Slots every day of the Campaign' }));

        expect(summary()).toContain('6 Slots');
        fireEvent.click(screen.getByTestId('calendar-day-2030-01-09'));
        for (const name of ['Slot 1 at 8:00 AM', 'Slot 2 at 9:00 AM']) {
            expect((await screen.findByRole('button', { name })).getAttribute('aria-pressed')).toBe('true');
        }
    });
    it('lists picks left outside the Campaign’s Stores or dates by an earlier step, so they can be dropped', async () => {
        render(<Wizard initial={{
            repeatDaily: false,
            selectedSlots: [
                { store_id: 'store_1', date: '2030-01-12', hour: 8, position: 0, price: 15.75 },
                { store_id: 'store_3', date: '2030-01-07', hour: 8, position: 0, price: 15.75 },
            ],
            storeNames: { ...wizardData.storeNames, store_3: 'Airport Café' },
        }} />);

        const listed = await screen.findByRole('region', { name: 'Days with unavailable Slots' });
        expect(within(listed).getAllByRole('listitem').map(item => item.textContent.replace(/Drop$/, ''))).toEqual([
            'Mon, Jan 7: Slot 1 at 8:00 AM, Airport Café, is outside the Campaign’s Stores or dates.',
            'Sat, Jan 12: Slot 1 at 8:00 AM, Downtown Café, is outside the Campaign’s Stores or dates.',
        ]);
        expect(getSlotAvailability.mock.calls.map(([storeId]) => storeId)).not.toContain('store_3');

        fireEvent.click(within(listed).getByRole('button', { name: 'Drop all' }));
        expect(conflicts()).toBeNull();
        expect(summary()).toContain('0 Slots');
    });

    it('repeats the picked Slots onto dates added to the Campaign after they were picked', async () => {
        const onNext = vi.fn();
        render(<Wizard onNext={onNext} initial={{
            // Picked when the Campaign ran 7-8 Jan; it now runs to 9 Jan.
            slotDates: ['2030-01-07', '2030-01-08'],
            selectedSlots: [picked(8, 0, 15.75), picked(8, 0, 15.75, { date: '2030-01-08' })],
        }} />);

        await screen.findByRole('row', { name: /8:00 AM/ });
        expect(summary()).toContain('3 Slots');
        fireEvent.click(screen.getByTestId('calendar-day-2030-01-09'));
        expect((await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' })).getAttribute('aria-pressed'))
            .toBe('true');
    });

    it('does not bring back a day the Brand dropped when it returns to the Slot step', async () => {
        render(<Wizard initial={{
            slotDates: ['2030-01-07', '2030-01-08', '2030-01-09'],
            selectedSlots: [picked(8, 0, 15.75), picked(8, 0, 15.75, { date: '2030-01-09' })],
        }} />);

        await screen.findByRole('row', { name: /8:00 AM/ });
        expect(summary()).toContain('2 Slots');
    });

    it('prices a repeated pick from its own day once that day loads, and passes the prices on', async () => {
        let loadLastDay;
        getSlotAvailability.mockImplementation((storeId, date) => (storeId === 'store_1' && date === '2030-01-09'
            ? new Promise(resolve => { loadLastDay = resolve; })
            : Promise.resolve(availability())));
        const priced = availability();
        priced.hours[0].price = 20;
        let submitted;
        function Capture() {
            const [data, setData] = useState({ ...wizardData, dateRange: THREE_DAYS });
            return (
                <Step3LoopSlotSelection
                    data={data}
                    updateData={update => {
                        if (update.selectedSlots) submitted = update.selectedSlots;
                        setData(previous => ({ ...previous, ...update }));
                    }}
                    onNext={vi.fn()}
                    onPrev={vi.fn()}
                />
            );
        }
        render(<Capture />);

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' }));
        expect(screen.getByTestId('step-3-next-btn').disabled).toBe(true);
        await act(async () => loadLastDay(priced));

        expect(summary()).toContain('$51.50');
        fireEvent.click(screen.getByTestId('step-3-next-btn'));
        expect(submitted.map(pick => pick.price)).toEqual([15.75, 15.75, 20]);
    });
});

describe('Brand wizard slot grid for a multi-file Creative', () => {
    // 8:00 AM: P P R P P I P P R P P P, so two-Slot runs start at Slots 1, 4, 7, 10 and 11.
    beforeEach(() => {
        vi.clearAllMocks();
        getSlotAvailability.mockImplementation(async (storeId, date, files = 1) =>
            availability([8], { runLength: files }));
    });

    /** The wizard's own state, so each choice is seen by the next render. */
    function Wizard({ initial }) {
        const [data, setData] = useState({ ...wizardData, repeatDaily: false, ...initial });
        Wizard.latest = data;
        return (
            <Step3LoopSlotSelection
                data={data}
                updateData={update => setData(previous => ({ ...previous, ...update }))}
                onNext={vi.fn()}
                onPrev={vi.fn()}
            />
        );
    }
    const positionsPicked = () => Wizard.latest.selectedSlots.map(pick => pick.position).sort((a, b) => a - b);

    it('asks how long the advertisement is, and loads runs long enough for it', async () => {
        render(<Wizard initial={{}} />);
        await screen.findByRole('row', { name: /8:00 AM/ });
        expect(screen.getByRole('radio', { name: '5 seconds · 1 file' }).checked).toBe(true);

        fireEvent.click(screen.getByRole('radio', { name: '10 seconds · 2 files' }));

        await vi.waitFor(() => expect(getSlotAvailability).toHaveBeenCalledWith('store_1', '2030-01-07', 2));
        expect(Wizard.latest.creativeFiles).toBe(2);
    });

    it('picks a whole run of consecutive Paid Slots at once, and unpicks it whole', async () => {
        render(<Wizard initial={{ creativeFiles: 2 }} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Slot 5 at 8:00 AM' }));
        expect(positionsPicked()).toEqual([3, 4]);
        expect(screen.getByRole('cell', { name: 'Slot 4 at 8:00 AM: Paid, picked' })).toBeTruthy();

        // Slots 10–12 hold one run of two; once 10 and 11 are picked, 12 has no partner left.
        fireEvent.click(screen.getByRole('button', { name: 'Slot 10 at 8:00 AM' }));
        expect(positionsPicked()).toEqual([3, 4, 9, 10]);
        expect(within(screen.getByRole('cell', { name: 'Slot 12 at 8:00 AM: Paid, free' })).queryByRole('button'))
            .toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Slot 11 at 8:00 AM' }));
        expect(positionsPicked()).toEqual([3, 4]);
    });

    it('offers no free Paid Slot that is outside every run of the right length', async () => {
        render(<Wizard initial={{ creativeFiles: 3 }} />);

        const eightAm = await screen.findByRole('row', { name: /8:00 AM/ });
        expect(within(eightAm).getAllByRole('button').map(button => button.getAttribute('aria-label')))
            .toEqual(['Slot 10 at 8:00 AM', 'Slot 11 at 8:00 AM', 'Slot 12 at 8:00 AM']);
        expect(within(screen.getByRole('cell', { name: 'Slot 1 at 8:00 AM: Paid, free' })).queryByRole('button'))
            .toBeNull();
    });

    it('drops picks and any uploaded Creative when the length changes', async () => {
        render(<Wizard initial={{ creativeAssetId: 'ast_old', creativeUrl: '/api/assets/ast_old/content' }} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Slot 1 at 8:00 AM' }));
        expect(positionsPicked()).toEqual([0]);

        fireEvent.click(screen.getByRole('radio', { name: '15 seconds · 3 files' }));

        expect(Wizard.latest).toMatchObject({
            creativeFiles: 3, selectedSlots: [], creativeAssetId: null, creativeUrl: '',
        });
    });
});
