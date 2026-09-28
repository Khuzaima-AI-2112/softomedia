/**
 * A change to a Store's opening hours never releases a Reservation silently.
 * A change drops a held Reservation when its Slot is Paid under the current
 * hours but not under the new ones: the hour closes, or the day now opens at
 * another time and the allocation pattern moves the position off Paid.
 */

import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import { BusinessHoursService } from './BusinessHoursService.js';
import { isPaidSlot } from './SlotInventory.js';
import { storeLocalNow } from './SlotReservations.js';

const asListed = ({ store_id: storeId, date, hour, position, campaign_id: campaignId }) => ({
    store_id: storeId, date, hour, position, campaign_id: campaignId,
});

const bySlot = (a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.position - b.position;

/**
 * The upcoming Reservations a change would drop, in Slot order.
 * @param {object} store
 * @param {Function} proposedHoursOn - (date, currentHours) => the date's hours
 *   after the change, or null when the change leaves the date as it is
 */
async function droppedReservations(store, proposedHoursOn) {
    const today = storeLocalNow(new Date(), store.time_zone || 'UTC').date;
    const held = await slotReservationRepository.findHeldForStoreFrom(store.id, today);

    const dates = [...new Set(held.map(reservation => reservation.date))];
    const hoursByDate = new Map(await Promise.all(dates.map(async date => {
        const current = await BusinessHoursService.getEffectiveHours(store.id, date);
        return [date, { current, proposed: proposedHoursOn(date, current) }];
    })));

    return held
        .filter(({ date, hour, position }) => {
            const { current, proposed } = hoursByDate.get(date);
            return proposed && isPaidSlot(current, hour, position) && !isPaidSlot(proposed, hour, position);
        })
        .map(asListed)
        .sort(bySlot);
}

/** Reservations that saving these weekly hours would drop. Special Hours dates keep their hours. */
export function reservationsDroppedByWeeklyHours(store, weeklyHours) {
    return droppedReservations(store, (date, current) => (current.type === 'special'
        ? null
        : BusinessHoursService.weeklyHoursOn(weeklyHours, date) || null));
}

/** Reservations that saving these Special Hours for a date would drop. */
export function reservationsDroppedBySpecialHours(store, specialDate, hoursData) {
    return droppedReservations(store, date => (date === specialDate ? hoursData : null));
}
