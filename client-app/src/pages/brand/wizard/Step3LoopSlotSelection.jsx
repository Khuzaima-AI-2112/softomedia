import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../../components/GlassCard';
import SlotGrid, { BookFullLoopButton } from '../../../components/SlotGrid';
import TrafficTierBadge from '../../../components/TrafficTierBadge';
import { PriceSummary } from '../../../components/PriceDisplay';
import apiService from '../../../services/ApiService';
import pricingService from '../../../services/PricingService';

// Constants for fallback business hours
const FALLBACK_HOURS = { START: 8, END: 22 };

const formatHour = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${suffix}`;
};

function Step3LoopSlotSelection({ data, updateData, onNext, onPrev }) {
    const getLocalISO = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(data.dateRange?.start || getLocalISO());
    const [expandedHour, setExpandedHour] = useState(null);
    const [selections, setSelections] = useState(data.selectedSlots || []);
    const [loading, setLoading] = useState(true);
    const [loops, setLoops] = useState([]);
    const [hasRealInventory, setHasRealInventory] = useState(true);
    const [businessHoursRange, setBusinessHoursRange] = useState({ start: 8, end: 22, is_closed: false });

    const businessHours = useMemo(() => {
        if (businessHoursRange.is_closed) return [];
        const hours = [];
        for (let h = businessHoursRange.start; h < businessHoursRange.end; h++) {
            hours.push(h);
        }
        return hours;
    }, [businessHoursRange]);

    useEffect(() => {
        const init = async () => {

            setLoading(true);
            try {
                await pricingService.init();
                await loadLoops();

            } catch (err) {
                console.error('[Diagnostic] Step 3 Init failed:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [selectedDate, data.selectedScreens]);

    const loadLoops = async () => {
        try {
            // Get loops for selected screens and date from backend
            const locationId = (data.selectedStores || [])[0];

            const response = await apiService.getLoops({
                date: selectedDate,
                location_id: locationId,
                screenId: (data.selectedScreens || []).join(',')
            });

            const activeLoops = Array.isArray(response) ? response : (response.loops || []);
            const newRange = response.business_hours || FALLBACK_HOURS;

            setHasRealInventory(activeLoops.length > 0);

            setBusinessHoursRange(newRange);

            const hoursList = [];
            if (!newRange.is_closed) {
                for (let h = newRange.start; h < newRange.end; h++) {
                    hoursList.push(h);
                }
            }

            const allLoops = [];
            (data.selectedScreens || []).forEach(screenId => {
                hoursList.forEach(hour => {
                    const existingLoop = activeLoops.find(l => l.screen_id === screenId && l.hour === hour);
                    if (existingLoop) {
                        allLoops.push(existingLoop);
                    } else {
                        allLoops.push({
                            id: `loop_${screenId}_${selectedDate}_${hour}`,
                            screen_id: screenId,
                            date: selectedDate,
                            hour,
                            slots: Array(12).fill({ status: 'available' }),
                            totalSlots: 12,
                            bookedSlots: 0
                        });
                    }
                });
            });
            setLoops(allLoops);

        } catch (error) {
            console.error('[Diagnostic] Failed to load loops:', error);
        }
    };

    // Group loops by hour
    const loopsByHour = useMemo(() => {
        const grouped = {};
        businessHours.forEach(hour => {
            grouped[hour] = loops.filter(l => l.hour === hour);
        });
        return grouped;
    }, [loops, businessHours]);

    const getHourSummary = (hour) => {
        const hourLoops = loopsByHour[hour] || [];
        const totalSlots = hourLoops.length * 12;
        const availableSlots = hourLoops.reduce((sum, loop) =>
            sum + loop.slots.filter(s => s.status === 'available').length, 0
        );
        const trafficTier = pricingService.getTrafficTier(hour);

        let avgPrice = 0;
        if (hourLoops.length > 0) {
            const prices = hourLoops.map(loop =>
                pricingService.getSlotPrice(loop.screen_id, selectedDate, hour).price
            );
            avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        }

        return {
            totalSlots,
            availableSlots,
            trafficTier,
            avgPrice,
            loopCount: hourLoops.length
        };
    };

    const handleSlotToggle = (loopId, slotIndex) => {
        const key = `${loopId}_${slotIndex}`;
        const existing = selections.find(s => s.key === key);

        if (existing) {
            setSelections(selections.filter(s => s.key !== key));
        } else {
            const loop = loops.find(l => l.id === loopId);
            if (loop) {
                const pricing = pricingService.getSlotPrice(loop.screen_id, selectedDate, loop.hour);
                setSelections([...selections, {
                    key,
                    loopId,
                    slotIndex,
                    screen_id: loop.screen_id,
                    date: selectedDate,
                    hour: loop.hour,
                    price: pricing.price
                }]);
            }
        }
    };

    const handleBookFullLoop = (loopId) => {
        const loop = loops.find(l => l.id === loopId);
        if (!loop) return;

        const newSelections = selections.filter(s => !s.loopId.startsWith(loopId));
        const pricing = pricingService.getSlotPrice(loop.screen_id, selectedDate, loop.hour);
        loop.slots.forEach((slot, index) => {
            if (slot.status === 'available') {
                newSelections.push({
                    key: `${loopId}_${index}`,
                    loopId,
                    slotIndex: index,
                    screen_id: loop.screen_id,
                    date: selectedDate,
                    hour: loop.hour,
                    price: pricing.price
                });
            }
        });
        setSelections(newSelections);
    };

    const getLoopSelections = (loopId) => {
        return selections.filter(s => s.loopId === loopId).map(s => s.slotIndex);
    };

    const totals = useMemo(() => {
        const totalCost = selections.reduce((sum, s) => sum + s.price, 0);
        const totalSlots = selections.length;
        let totalImpressions = 0;
        selections.forEach(s => {
            totalImpressions += pricingService.getEstimatedImpressions(s.screen_id, s.hour);
        });
        return { totalCost, totalSlots, totalImpressions };
    }, [selections]);

    const getWeekDays = () => {
        const days = [];
        const startDate = new Date(data.dateRange?.start || new Date());
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            days.push({
                date: getLocalISO(date),
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: date.getDate(),
                isToday: getLocalISO(date) === getLocalISO(),
                isSelected: getLocalISO(date) === selectedDate
            });
        }
        return days;
    };

    const handleContinue = () => {

        updateData({ selectedSlots: selections });
        onNext();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p>Loading loops and pricing...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <GlassCard className="border-l-4 border-l-primary">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Step 3: Select Loops & Slots</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Choose which hourly loops and time slots to book
                        </p>
                    </div>
                </div>
            </GlassCard>

            <div className="flex gap-2 overflow-x-auto pb-2">
                {getWeekDays().map(day => (
                    <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        data-testid={`calendar-day-${day.date}`}
                        className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border transition-all ${day.isSelected ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                    >
                        <span className={`text-xs ${day.isSelected ? 'text-white/80' : 'text-slate-500'}`}>{day.dayName}</span>
                        <span className="text-2xl font-bold">{day.dayNum}</span>
                    </button>
                ))}
            </div>

            {!hasRealInventory && !businessHoursRange.is_closed && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl">warning</span>
                    <div>
                        <p className="font-bold">Inventory Validation Failed</p>
                        <p className="text-sm">No hourly loops have been generated for {selectedDate} by the network operator yet. You cannot book active slots until inventory is generated.</p>
                    </div>
                </div>
            )}

            {businessHoursRange.is_closed ? (
                <GlassCard className="py-16 text-center">
                    <h3 className="text-xl font-bold mb-2 text-red-500">Store is Closed</h3>
                    <p className="text-slate-500">Pick another date.</p>
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24">
                    {businessHours.map(hour => {
                        const summary = getHourSummary(hour);
                        const isExpanded = expandedHour === hour;
                        return (
                            <GlassCard key={hour} className={`cursor-pointer transition-all ${isExpanded ? 'lg:col-span-2 ring-2 ring-primary' : ''}`}>
                                <div className="flex items-center justify-between" onClick={() => setExpandedHour(isExpanded ? null : hour)} data-testid={`hour-row-${hour}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">{hour}</div>
                                        <div>
                                            <p className="font-semibold">{formatHour(hour)}</p>
                                            <p className="text-xs text-slate-500">{summary.availableSlots}/{summary.totalSlots} slots</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <TrafficTierBadge tier={summary.trafficTier.key} size="small" />
                                        <span className="material-symbols-outlined transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }}>expand_more</span>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t space-y-4">
                                        {loopsByHour[hour]?.map(loop => (
                                            <div key={loop.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                                <div className="mb-3 font-medium text-sm">{loop.screen_id}</div>
                                                <SlotGrid
                                                    slots={loop.slots}
                                                    trafficTier={summary.trafficTier}
                                                    pricePerSlot={pricingService.getSlotPrice(loop.screen_id, selectedDate, hour).price}
                                                    selectedSlots={getLoopSelections(loop.id)}
                                                    onSlotClick={(index) => handleSlotToggle(loop.id, index)}
                                                />
                                                <div className="mt-3">
                                                    <BookFullLoopButton onClick={() => handleBookFullLoop(loop.id)} pricePerSlot={pricingService.getSlotPrice(loop.screen_id, selectedDate, hour).price} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </GlassCard>
                        );
                    })}
                </div>
            )}

            <div className="sticky bottom-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t p-4 -mx-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <PriceSummary
                        totalPrice={totals.totalCost}
                        totalSlots={totals.totalSlots}
                        totalImpressions={totals.totalImpressions}
                    />
                    <div className="flex gap-3">
                        <button onClick={onPrev} className="px-6 py-3 rounded-xl border">Back</button>
                        <button
                            onClick={handleContinue}
                            disabled={selections.length === 0 || !hasRealInventory}
                            data-testid="step-3-next-btn"
                            className="px-8 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
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
