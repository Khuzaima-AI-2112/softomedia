/**
 * SlotGrid Component
 * 12-slot grid visualization for loop booking
 */

import React from 'react';
import TrafficTierBadge from './TrafficTierBadge';
import { PriceInline } from './PriceDisplay';

function SlotGrid({
    slots = [],
    trafficTier = null,
    pricePerSlot = 0,
    onSlotClick = null,
    selectedSlots = [],
    disabled = false,
    showPrices = true,
    compact = false
}) {
    // Default to 12 available slots if not provided
    const displaySlots = slots.length === 12 ? slots : Array(12).fill({ status: 'available' });

    const getSlotStyle = (slot, index) => {
        const isSelected = selectedSlots.includes(index);
        const isBooked = slot.status === 'booked';
        const isRejected = slot.status === 'rejected';
        const isAvailable = slot.status === 'available';

        if (isRejected) {
            return 'bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700 text-rose-600 cursor-not-allowed';
        }
        if (isBooked && !isSelected) {
            return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 cursor-not-allowed';
        }
        if (isSelected) {
            return 'bg-primary text-white border-primary shadow-lg shadow-primary/30 ring-2 ring-primary/50';
        }
        if (isAvailable && !disabled) {
            return 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all';
        }
        return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400';
    };

    const handleClick = (index) => {
        if (disabled) return;
        const slot = displaySlots[index];
        if (slot.status !== 'available' && !selectedSlots.includes(index)) return;
        if (onSlotClick) {
            onSlotClick(index, slot);
        }
    };

    const gridClass = compact
        ? 'grid grid-cols-12 gap-1'
        : 'grid grid-cols-6 sm:grid-cols-12 gap-2';

    const slotClass = compact
        ? 'h-6 text-[10px]'
        : 'h-12 sm:h-10 text-xs';

    return (
        <div className="space-y-3">
            {/* Header with traffic tier and price */}
            {(trafficTier || showPrices) && (
                <div className="flex items-center justify-between">
                    {trafficTier && (
                        <TrafficTierBadge tier={trafficTier.key || trafficTier} size={compact ? 'small' : 'default'} />
                    )}
                    {showPrices && pricePerSlot > 0 && (
                        <span className="text-xs text-slate-500">
                            <PriceInline price={pricePerSlot} /> per slot
                        </span>
                    )}
                </div>
            )}

            {/* Slot Grid */}
            <div className={gridClass}>
                {displaySlots.map((slot, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => handleClick(index)}
                        disabled={disabled || (slot.status !== 'available' && !selectedSlots.includes(index))}
                        className={`
                            ${slotClass}
                            flex items-center justify-center
                            rounded-lg border font-medium
                            transition-all duration-150
                            ${getSlotStyle(slot, index)}
                        `}
                        title={
                            slot.status === 'booked'
                                ? `Booked${slot.advertiserId ? ` by ${slot.advertiserId}` : ''}`
                                : slot.status === 'rejected'
                                    ? `Rejected: ${slot.rejectedReason || 'No reason provided'}`
                                    : `Slot ${index + 1} - Click to ${selectedSlots.includes(index) ? 'deselect' : 'select'}`
                        }
                    >
                        {compact ? (
                            slot.status === 'booked' ? '●' : (selectedSlots.includes(index) ? '✓' : '')
                        ) : (
                            <>
                                {slot.status === 'booked' && !selectedSlots.includes(index) && (
                                    <span className="material-symbols-outlined text-sm">lock</span>
                                )}
                                {slot.status === 'rejected' && (
                                    <span className="material-symbols-outlined text-sm">block</span>
                                )}
                                {slot.status === 'available' && selectedSlots.includes(index) && (
                                    <span className="material-symbols-outlined text-sm">check</span>
                                )}
                                {slot.status === 'available' && !selectedSlots.includes(index) && (
                                    <span>{index + 1}</span>
                                )}
                            </>
                        )}
                    </button>
                ))}
            </div>

            {/* Legend */}
            {!compact && (
                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700"></span>
                        Available
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded bg-primary"></span>
                        Selected
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded bg-slate-200 dark:bg-slate-700"></span>
                        Booked
                    </span>
                </div>
            )}

            {/* Selection Summary */}
            {selectedSlots.length > 0 && !compact && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {selectedSlots.length} of 12 slots selected
                    </span>
                    {pricePerSlot > 0 && (
                        <span className="text-sm font-bold text-primary">
                            Total: <PriceInline price={pricePerSlot * selectedSlots.length} />
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// Full loop quick-book button
export function BookFullLoopButton({ onClick, pricePerSlot, disabled = false }) {
    const totalPrice = pricePerSlot * 12;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
            <span className="material-symbols-outlined">all_inclusive</span>
            <span>Book Full Loop (12 Slots)</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-sm">
                <PriceInline price={totalPrice} className="text-white" />
            </span>
        </button>
    );
}

export default SlotGrid;
