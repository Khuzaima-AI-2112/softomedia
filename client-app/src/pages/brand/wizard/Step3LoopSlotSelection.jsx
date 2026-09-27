import { useState, useEffect } from 'react';
import GlassCard from '../../../components/GlassCard';
import TrafficTierBadge from '../../../components/TrafficTierBadge';
import apiService from '../../../services/ApiService';
import { sameSlot } from './slots';

const CATEGORY_LABELS = { paid: 'Paid', retailer: 'Retailer', internal: 'Internal' };

const formatHour = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${suffix}`;
};

const formatPrice = (price, currency = 'USD') => new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(price);

const toISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Parsed as a local date so the strip never shifts a day in western time zones.
const localDate = (isoDate) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day);
};

// Picked is the Brand's unsubmitted choice; yours and taken are held Reservations.
const PAID_STYLES = {
    free: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
    picked: 'bg-primary border-primary text-white',
    yours: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300',
    taken: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300',
};
const RESERVED_STYLE = 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400';

function SlotCell({ slot, hour, isPicked, canPick, onToggle }) {
    const name = `Slot ${slot.position + 1} at ${formatHour(hour)}`;
    // Retailer and Internal Slots are never bookable and carry no status.
    const state = slot.category !== 'paid' ? 'reserved' : isPicked ? 'picked' : slot.status;
    const label = `${name}: ${CATEGORY_LABELS[slot.category]}, ${state}`;
    const pickable = (state === 'free' && canPick) || state === 'picked';
    return (
        <td
            aria-label={label}
            title={label}
            className={`h-10 min-w-10 rounded-lg border text-center text-[10px] font-medium ${PAID_STYLES[state] || RESERVED_STYLE}`}
        >
            {pickable ? (
                <button
                    type="button"
                    aria-label={name}
                    aria-pressed={isPicked}
                    onClick={onToggle}
                    data-testid={`slot-${hour}-${slot.position}`}
                    className="size-full"
                >
                    {isPicked ? '✓' : slot.position + 1}
                </button>
            ) : state === 'free' ? slot.position + 1 : state}
        </td>
    );
}

function BookingCutoff({ open, cutoff }) {
    if (!cutoff.time_zone) {
        return (
            <p data-testid="booking-cutoff" className="mb-3 text-sm font-semibold text-red-500">
                This Store is not taking bookings yet.
            </p>
        );
    }
    const day = localDate(cutoff.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const when = `${cutoff.time} on ${day}, Store time (${cutoff.time_zone})`;
    return (
        <p
            data-testid="booking-cutoff"
            className={`mb-3 text-sm ${open ? 'text-slate-500' : 'font-semibold text-red-500'}`}
        >
            {open
                ? `Booking for this date closes at ${when}.`
                : `Booking for this date closed at ${when}. Choose a later date.`}
        </p>
    );
}

function Step3LoopSlotSelection({ data, updateData, onNext, onPrev }) {
    const stores = data.selectedStores || [];
    const selectedSlots = data.selectedSlots || [];
    const firstDate = data.dateRange?.start || toISODate(new Date());
    const [storeId, setStoreId] = useState(stores[0]);
    const [selectedDate, setSelectedDate] = useState(firstDate);
    const [availability, setAvailability] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let current = true;
        setAvailability(null);
        setFailed(false);
        // Prices come with availability: a Brand may not read the pricing
        // configuration, and after a reload nothing else has loaded it (#27).
        apiService.getSlotAvailability(storeId, selectedDate)
            .then(response => { if (current) setAvailability(response); })
            .catch(error => {
                console.error('[Diagnostic] Failed to load Slot availability:', error);
                if (current) setFailed(true);
            });
        return () => { current = false; };
    }, [storeId, selectedDate]);

    const toggle = (hour, price, position) => {
        const slot = { store_id: storeId, date: selectedDate, hour, position };
        const alreadyPicked = selectedSlots.some(candidate => sameSlot(candidate, slot));
        updateData({
            selectedSlots: alreadyPicked
                ? selectedSlots.filter(candidate => !sameSlot(candidate, slot))
                : [...selectedSlots, { ...slot, price }],
        });
    };

    const total = selectedSlots.reduce((sum, slot) => sum + slot.price, 0);

    const weekDays = Array.from({ length: 7 }, (_, offset) => {
        const date = localDate(firstDate);
        date.setDate(date.getDate() + offset);
        return {
            date: toISODate(date),
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: date.getDate(),
        };
    });

    const renderAvailability = () => {
        if (failed) {
            return (
                <GlassCard className="py-12 text-center" data-testid="slots-unavailable">
                    <h3 className="text-lg font-bold mb-2">Slot availability could not be loaded</h3>
                    <p className="text-slate-500">Try another date, or come back later.</p>
                </GlassCard>
            );
        }
        if (!availability) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                    <p>Loading Slots...</p>
                </div>
            );
        }
        if (availability.is_closed) {
            return (
                <GlassCard className="py-16 text-center">
                    <h3 className="text-xl font-bold mb-2 text-red-500">Store is closed on this date</h3>
                    <p className="text-slate-500">Pick another date.</p>
                </GlassCard>
            );
        }
        return (
            <GlassCard className="overflow-x-auto">
                <BookingCutoff open={availability.booking_open} cutoff={availability.booking_cutoff} />
                <table className="w-full border-separate border-spacing-1" aria-label="Slots by hour">
                    <tbody>
                        {availability.hours.map(({ hour, price, tier, slots }) => (
                            <tr key={hour} aria-label={formatHour(hour)} data-testid={`hour-row-${hour}`}>
                                <th scope="row" className="pr-3 text-left text-sm font-semibold whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <span>{formatHour(hour)}</span>
                                        <TrafficTierBadge tier={tier} size="small" />
                                        <span className="text-xs font-bold text-emerald-600">
                                            {formatPrice(price, availability.currency)}
                                        </span>
                                    </div>
                                </th>
                                {slots.map(slot => (
                                    <SlotCell
                                        key={slot.position}
                                        slot={slot}
                                        hour={hour}
                                        isPicked={selectedSlots.some(candidate => sameSlot(candidate, {
                                            store_id: storeId, date: selectedDate, hour, position: slot.position,
                                        }))}
                                        canPick={availability.booking_open}
                                        onToggle={() => toggle(hour, price, slot.position)}
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                    {[
                        ['border-emerald-300 bg-emerald-100', 'Free Paid Slot'],
                        ['border-primary bg-primary', 'Picked'],
                        ['border-blue-300 bg-blue-100', 'Already yours'],
                        ['border-red-300 bg-red-100', 'Taken by another Brand'],
                        ['border-slate-300 bg-slate-100', 'Reserved for the Retailer or Softomedia'],
                    ].map(([swatch, legend]) => (
                        <span key={legend} className="flex items-center gap-1.5">
                            <span className={`size-3 rounded border ${swatch}`}></span>
                            {legend}
                        </span>
                    ))}
                </div>
            </GlassCard>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <GlassCard className="border-l-4 border-l-primary">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Step 3: Slots</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Each hourly loop has twelve five-second Slots. Pick the free Paid Slots, shown in green, that you want to reserve.
                        </p>
                    </div>
                </div>
            </GlassCard>

            {data.slotConflict && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-sm font-medium text-red-700 dark:text-red-300"
                >
                    {data.slotConflict}
                </div>
            )}

            {stores.length > 1 && (
                <div role="tablist" aria-label="Stores" className="flex gap-2 overflow-x-auto pb-2">
                    {stores.map(id => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={id === storeId}
                            onClick={() => setStoreId(id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${id === storeId
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                        >
                            {data.storeNames?.[id] || id}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-2">
                {weekDays.map(day => (
                    <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        data-testid={`calendar-day-${day.date}`}
                        className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border transition-all ${day.date === selectedDate ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                    >
                        <span className={`text-xs ${day.date === selectedDate ? 'text-white/80' : 'text-slate-500'}`}>{day.dayName}</span>
                        <span className="text-2xl font-bold">{day.dayNum}</span>
                    </button>
                ))}
            </div>

            {renderAvailability()}

            <div className="sticky bottom-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t p-4 -mx-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                    <p data-testid="slot-selection-summary" className="text-sm text-slate-500">
                        <span className="font-bold text-primary">
                            {selectedSlots.length} {selectedSlots.length === 1 ? 'Slot' : 'Slots'}
                        </span>
                        {' picked · '}
                        <span className="font-bold">{formatPrice(total, availability?.currency)}</span>
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onPrev} className="px-6 py-3 rounded-xl border">Back</button>
                        <button
                            onClick={onNext}
                            disabled={selectedSlots.length === 0}
                            data-testid="step-3-next-btn"
                            className="px-8 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Step3LoopSlotSelection;
