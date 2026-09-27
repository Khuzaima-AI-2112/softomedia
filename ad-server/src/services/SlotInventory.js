/**
 * Slot inventory: which Slots exist for a Store, date and hour, what category
 * each is, and whether it is free. It is answered from the Store's effective
 * opening hours and the allocation pattern alone, so it needs no generated loop.
 */

import { BusinessHoursService } from './BusinessHoursService.js';

export const SLOTS_PER_LOOP = 12;

// Repeating ten-position cadence, restarted at position 0 at the start of each
// broadcast day (ADR 0004). Six repetitions form a five-loop Allocation Window
// (60 positions) with the exact accepted 70/20/10 split.
const ALLOCATION_SEQUENCE = Object.freeze([
    'paid', 'paid', 'retailer', 'paid', 'paid',
    'internal', 'paid', 'paid', 'retailer', 'paid'
]);

/** Day position of an hour's first Slot, counted from the day's first operating hour. */
export function firstPositionOfHour(hour, openingHour) {
    return (hour - openingHour) * SLOTS_PER_LOOP;
}

/** Category of the Slot at this day position. */
export function allocatedCategory(dayPosition) {
    return ALLOCATION_SEQUENCE[dayPosition % ALLOCATION_SEQUENCE.length];
}

/**
 * Every Slot of every operating hour of a Store on a date. A Paid Slot's
 * status says whether a Brand may book it; Retailer and Internal Slots are
 * never bookable and have no status.
 */
export async function slotInventory(storeId, date) {
    const effectiveHours = await BusinessHoursService.getEffectiveHours(storeId, date);
    const { start, end, is_closed: isClosed } = BusinessHoursService.getOperatingHourRange(effectiveHours);

    const hours = [];
    for (let hour = start; !isClosed && hour < end; hour++) {
        const hourStart = firstPositionOfHour(hour, start);
        hours.push({
            hour,
            slots: Array.from({ length: SLOTS_PER_LOOP }, (_, position) => {
                const category = allocatedCategory(hourStart + position);
                return { position, category, status: category === 'paid' ? 'free' : null };
            }),
        });
    }

    return { store_id: storeId, date, is_closed: isClosed, hours };
}
