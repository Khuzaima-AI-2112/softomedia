/**
 * Slot Reservations as a Brand sees and makes them (ADR 0005): which Paid
 * Slots are free, taken or the Brand's own, what each costs, whether the date
 * is still open for booking, and which submitted picks may be reserved.
 */

import PricingRepository from '../repositories/PricingRepository.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { slotReservationRepository } from '../repositories/SlotReservationRepository.js';
import { slotQuote } from './CampaignPricingService.js';
import { SLOTS_PER_LOOP, slotInventory } from './SlotInventory.js';

export const BOOKING_CUTOFF_TIME = '18:00';
const BOOKING_CUTOFF_DAYS_BEFORE = 2;

export const isCalendarDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

/** The Store-local date and time now, as YYYY-MM-DD and HH:mm. */
export function storeLocalNow(now, timeZone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(now)
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The Booking Cutoff for a broadcast date: 18:00 two days before it, Store time. */
export function bookingCutoff(date, timeZone) {
    const cutoffDate = new Date(`${date}T00:00:00Z`);
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - BOOKING_CUTOFF_DAYS_BEFORE);
    return { date: cutoffDate.toISOString().slice(0, 10), time: BOOKING_CUTOFF_TIME, time_zone: timeZone };
}

/**
 * Whether Reservations for this date may still be made; they are refused from
 * the cutoff on, and always at a Store with no time zone, whose cutoff is unknown.
 */
export function isBookingOpen(date, timeZone, now = new Date()) {
    if (!timeZone) return false;
    const cutoff = bookingCutoff(date, timeZone);
    const local = storeLocalNow(now, timeZone);
    return `${local.date} ${local.time}` < `${cutoff.date} ${cutoff.time}`;
}

const cutoffDescription = ({ date, time, time_zone: timeZone }) => `${time} on ${date} (${timeZone})`;

/** The price of each Slot in an hour at this Store. */
const quoteFor = (config, store, date, hour) => slotQuote({
    config, retailerId: store.retailer_id, storeTier: store.cpm_traffic_tier, date, hour,
});

/**
 * Every Slot of a Store on a date as one Brand may see it. A Paid Slot is
 * free, taken by someone else, or the Brand's own; the holder is never named.
 * Every Paid Slot in an hour carries that hour's price.
 */
export async function slotAvailability(store, date, brandId) {
    const [inventory, reservations, config] = await Promise.all([
        slotInventory(store.id, date),
        slotReservationRepository.findForStoreAndDate(store.id, date),
        PricingRepository.getConfig(),
    ]);
    const holders = new Map(reservations.map(reservation => [
        `${reservation.hour}_${reservation.position}`, reservation.brand_id,
    ]));
    const statusOf = (hour, position) => {
        if (!holders.has(`${hour}_${position}`)) return 'free';
        return holders.get(`${hour}_${position}`) === brandId ? 'yours' : 'taken';
    };

    return {
        ...inventory,
        booking_open: isBookingOpen(date, store.time_zone),
        booking_cutoff: bookingCutoff(date, store.time_zone),
        currency: config.currency,
        hours: inventory.hours.map(({ hour, slots }) => ({
            hour,
            ...quoteFor(config, store, date, hour),
            slots: slots.map(slot => (slot.category === 'paid'
                ? { ...slot, status: statusOf(hour, slot.position) }
                : slot)),
        })),
    };
}

class ReservationRefused extends Error {
    constructor(message, code = 'INVALID_SLOTS') {
        super(message);
        this.code = code;
    }
}

/**
 * Validates a Brand's Slot picks and prices them. Each must be a distinct
 * Paid Slot in an operating hour, at a Store the Campaign books, on a Campaign
 * date whose Booking Cutoff has not passed.
 * @returns {{reservations: Array}|{error: string, code: string}}
 */
export async function prepareReservations({ slots, campaign, brandId }) {
    try {
        if (!Array.isArray(slots) || slots.length === 0) {
            throw new ReservationRefused('Choose at least one Paid Slot');
        }
        const bookedStores = new Set((campaign.inventory_selection || []).map(selection => selection.store_id));
        const keys = new Set();
        const [config, stores] = await Promise.all([
            PricingRepository.getConfig(),
            Promise.all([...bookedStores].map(id => StoreRepository.findById(id))),
        ]);
        const storesById = new Map(stores.filter(Boolean).map(store => [store.id, store]));
        const inventories = new Map();

        const reservations = [];
        for (const pick of slots) {
            const { store_id: storeId, date, hour, position } = pick ?? {};
            const store = storesById.get(storeId);
            if (!store || !isCalendarDate(date) || !Number.isInteger(hour) || !Number.isInteger(position)
                || position < 0 || position >= SLOTS_PER_LOOP) {
                throw new ReservationRefused('A picked Slot is not in this Campaign’s Stores');
            }
            if (date < campaign.start_date || date > campaign.end_date) {
                throw new ReservationRefused('A picked Slot is outside the Campaign’s dates');
            }
            const key = slotReservationRepository.idFor(pick);
            if (keys.has(key)) throw new ReservationRefused('A Slot was picked twice');
            keys.add(key);

            if (!store.time_zone) {
                throw new ReservationRefused(
                    'This Store is not taking bookings yet: its time zone is not set.', 'BOOKING_CLOSED',
                );
            }
            if (!isBookingOpen(date, store.time_zone)) {
                throw new ReservationRefused(
                    `Booking for ${date} closed at ${cutoffDescription(bookingCutoff(date, store.time_zone))}. `
                    + 'Choose a later date.',
                    'BOOKING_CLOSED',
                );
            }

            const inventoryKey = `${storeId}_${date}`;
            if (!inventories.has(inventoryKey)) inventories.set(inventoryKey, await slotInventory(storeId, date));
            const inventorySlot = inventories.get(inventoryKey).hours
                .find(candidate => candidate.hour === hour)?.slots[position];
            if (inventorySlot?.category !== 'paid') {
                throw new ReservationRefused('Only Paid Slots in the Store’s opening hours can be reserved');
            }

            const { price } = quoteFor(config, store, date, hour);
            reservations.push({ store_id: storeId, date, hour, position, brand_id: brandId, status: 'held', price });
        }
        return { reservations };
    } catch (error) {
        if (error instanceof ReservationRefused) return { error: error.message, code: error.code };
        throw error;
    }
}
