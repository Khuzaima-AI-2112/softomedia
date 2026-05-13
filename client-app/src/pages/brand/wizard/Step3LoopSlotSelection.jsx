import { useState, useEffect, useMemo } from 'react';
import apiService from '../../../services/ApiService';
import pricingService from '../../../services/PricingService';
import { PriceSummary } from '../../../components/PriceDisplay';
import '../../../design-tokens.css';

const FALLBACK_HOURS = { START: 8, END: 22 };

const formatHour = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${suffix}`;
};

// ─── Demand badge ────────────────────────────────────────────────────────────
const TIER_CONFIG = {
    low:    { label: 'Low Demand',    bg: 'rgba(16,185,129,0.1)',  color: '#059669', dot: '#059669' },
    medium: { label: 'Med Demand',   bg: 'rgba(245,158,11,0.1)',  color: '#d97706', dot: '#d97706' },
    high:   { label: 'High Demand',  bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', dot: '#dc2626' },
    peak:   { label: 'Peak',         bg: 'rgba(139,92,246,0.1)',  color: '#7c3aed', dot: '#7c3aed' },
};
function DemandBadge({ tier }) {
    const cfg = TIER_CONFIG[tier?.toLowerCase?.()] || TIER_CONFIG.low;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
            backgroundColor: cfg.bg, color: cfg.color,
            flexShrink: 0,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.dot, flexShrink: 0 }} />
            {cfg.label}
        </span>
    );
}

// ─── Slot strip ──────────────────────────────────────────────────────────────
function SlotStrip({ slots, selectedSlots, pricePerSlot, onSlotClick }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {slots.map((slot, i) => {
                const isSelected = selectedSlots.includes(i);
                const isBooked   = slot.status === 'booked';
                let bg, border, cursor;
                if (isBooked) {
                    bg = 'var(--color-bg-hover)'; border = '1px solid var(--color-border-light)'; cursor = 'not-allowed';
                } else if (isSelected) {
                    bg = 'var(--color-primary)'; border = '1.5px solid var(--color-primary)'; cursor = 'pointer';
                } else {
                    bg = 'var(--color-bg-hover)'; border = '1px solid var(--color-border)'; cursor = 'pointer';
                }
                return (
                    <button
                        key={i}
                        title={isBooked ? `Slot ${i + 1} · Booked` : `Slot ${i + 1} · $${pricePerSlot?.toFixed(2)}`}
                        disabled={isBooked}
                        onClick={() => !isBooked && onSlotClick(i)}
                        style={{
                            width: 28, height: 28, flexShrink: 0,
                            borderRadius: 'var(--radius-sm)',
                            border, backgroundColor: bg, cursor,
                            opacity: isBooked ? 0.4 : 1,
                            transition: 'all var(--transition-fast)',
                            padding: 0,
                        }}
                        onMouseEnter={e => { if (!isBooked && !isSelected) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.12)'; }}
                        onMouseLeave={e => { if (!isBooked && !isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                    />
                );
            })}
        </div>
    );
}

// ─── Book Full Loop button ────────────────────────────────────────────────────
function BookFullLoopBtn({ loop, pricePerSlot, onBook }) {
    const availableCount = loop.slots.filter(s => s.status === 'available').length;
    const total = availableCount * (pricePerSlot || 0);
    if (availableCount === 0) return null;
    return (
        <button
            onClick={onBook}
            style={{
                width: '100%', marginTop: '0.625rem',
                padding: '0.625rem 1rem',
                backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'background-color var(--transition-fast)',
                boxShadow: 'var(--shadow-md)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
        >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Book Full Loop
            <span style={{
                marginLeft: 4, padding: '1px 8px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)',
            }}>${total.toFixed(2)}</span>
        </button>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
function Step3LoopSlotSelection({ data, updateData, onNext, onPrev }) {
    const getLocalISO = (date = new Date()) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [selectedDate, setSelectedDate]       = useState(data.dateRange?.start || getLocalISO());
    const [expandedHour, setExpandedHour]       = useState(null);
    const [selections, setSelections]           = useState(data.selectedSlots || []);
    const [loading, setLoading]                 = useState(true);
    const [loops, setLoops]                     = useState([]);
    const [businessHoursRange, setBusinessHoursRange] = useState({ start: 8, end: 22, is_closed: false });

    const businessHours = useMemo(() => {
        if (businessHoursRange.is_closed) return [];
        const hours = [];
        for (let h = businessHoursRange.start; h < businessHoursRange.end; h++) hours.push(h);
        return hours;
    }, [businessHoursRange]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await pricingService.init();
                await loadLoops();
            } catch (err) {
                console.error('[Step3] Init failed:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [selectedDate, data.selectedScreens]);

    const loadLoops = async () => {
        try {
            const locationId = (data.selectedStores || [])[0];
            const response = await apiService.getLoops({
                date: selectedDate,
                location_id: locationId,
                screenId: (data.selectedScreens || []).join(',')
            });
            const activeLoops = Array.isArray(response) ? response : (response.loops || []);
            const newRange = response.business_hours || FALLBACK_HOURS;
            setBusinessHoursRange(newRange);
            const hoursList = [];
            if (!newRange.is_closed) {
                for (let h = newRange.start; h < newRange.end; h++) hoursList.push(h);
            }
            const allLoops = [];
            (data.selectedScreens || []).forEach(screenId => {
                hoursList.forEach(hour => {
                    const existing = activeLoops.find(l => l.screen_id === screenId && l.hour === hour);
                    allLoops.push(existing || {
                        id: `loop_${screenId}_${selectedDate}_${hour}`,
                        screen_id: screenId, date: selectedDate, hour,
                        slots: Array(12).fill({ status: 'available' }),
                        totalSlots: 12, bookedSlots: 0,
                    });
                });
            });
            setLoops(allLoops);
        } catch (err) {
            console.error('[Step3] Failed to load loops:', err);
        }
    };

    const loopsByHour = useMemo(() => {
        const grouped = {};
        businessHours.forEach(hour => { grouped[hour] = loops.filter(l => l.hour === hour); });
        return grouped;
    }, [loops, businessHours]);

    const getHourSummary = (hour) => {
        const hourLoops = loopsByHour[hour] || [];
        const totalSlots = hourLoops.length * 12;
        const availableSlots = hourLoops.reduce((sum, l) => sum + l.slots.filter(s => s.status === 'available').length, 0);
        const trafficTier = pricingService.getTrafficTier(hour);
        let avgPrice = 0;
        if (hourLoops.length > 0) {
            const prices = hourLoops.map(l => pricingService.getSlotPrice(l.screen_id, selectedDate, hour).price);
            avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        }
        return { totalSlots, availableSlots, trafficTier, avgPrice, loopCount: hourLoops.length };
    };

    const handleSlotToggle = (loopId, slotIndex) => {
        const key = `${loopId}_${slotIndex}`;
        if (selections.find(s => s.key === key)) {
            setSelections(selections.filter(s => s.key !== key));
        } else {
            const loop = loops.find(l => l.id === loopId);
            if (loop) {
                const pricing = pricingService.getSlotPrice(loop.screen_id, selectedDate, loop.hour);
                setSelections([...selections, { key, loopId, slotIndex, screen_id: loop.screen_id, date: selectedDate, hour: loop.hour, price: pricing.price }]);
            }
        }
    };

    const handleBookFullLoop = (loopId) => {
        const loop = loops.find(l => l.id === loopId);
        if (!loop) return;
        const next = selections.filter(s => !s.loopId.startsWith(loopId));
        const pricing = pricingService.getSlotPrice(loop.screen_id, selectedDate, loop.hour);
        loop.slots.forEach((slot, i) => {
            if (slot.status === 'available') {
                next.push({ key: `${loopId}_${i}`, loopId, slotIndex: i, screen_id: loop.screen_id, date: selectedDate, hour: loop.hour, price: pricing.price });
            }
        });
        setSelections(next);
    };

    const getLoopSelections = (loopId) => selections.filter(s => s.loopId === loopId).map(s => s.slotIndex);

    const totals = useMemo(() => {
        const totalCost = selections.reduce((sum, s) => sum + s.price, 0);
        const totalSlots = selections.length;
        let totalImpressions = 0;
        selections.forEach(s => { totalImpressions += pricingService.getEstimatedImpressions(s.screen_id, s.hour); });
        return { totalCost, totalSlots, totalImpressions };
    }, [selections]);

    const getWeekDays = () => {
        const days = [];
        const startDate = new Date(data.dateRange?.start || new Date());
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            days.push({
                date: getLocalISO(d),
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: d.getDate(),
                isSelected: getLocalISO(d) === selectedDate,
            });
        }
        return days;
    };

    const handleContinue = () => {
        updateData({ selectedSlots: selections, totalCost: totals.totalCost, totalImpressions: totals.totalImpressions });
        onNext();
    };

    // ── Shared card style ──
    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', color: 'var(--color-text-tertiary)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
                <p style={{ fontSize: 'var(--text-sm)' }}>Loading loops and pricing…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '5.5rem' }}>

            {/* Day tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: 4 }}>
                {getWeekDays().map(day => (
                    <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        data-testid={`calendar-day-${day.date}`}
                        style={{
                            flexShrink: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            minWidth: 56, minHeight: 64, padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1.5px solid ' + (day.isSelected ? 'var(--color-primary)' : 'var(--color-border)'),
                            backgroundColor: day.isSelected ? 'var(--color-primary)' : 'var(--color-bg-card)',
                            color: day.isSelected ? '#fff' : 'var(--color-text-primary)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            boxShadow: day.isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        }}
                    >
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', opacity: day.isSelected ? 0.85 : undefined, color: day.isSelected ? '#fff' : 'var(--color-text-secondary)' }}>{day.dayName}</span>
                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', lineHeight: 1.1 }}>{day.dayNum}</span>
                    </button>
                ))}
            </div>

            {/* Hour accordion rows */}
            {businessHoursRange.is_closed ? (
                <div style={{ ...card, padding: '4rem 2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-error)', marginBottom: '0.375rem' }}>Store is Closed</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Pick another date above.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                    {businessHours.map(hour => {
                        const summary    = getHourSummary(hour);
                        const isExpanded = expandedHour === hour;
                        return (
                            <div
                                key={hour}
                                style={{
                                    ...card,
                                    gridColumn: isExpanded ? '1 / -1' : undefined,
                                    outline: isExpanded ? '2px solid var(--color-primary)' : 'none',
                                    outlineOffset: 1,
                                    transition: 'outline var(--transition-fast)',
                                }}
                            >
                                {/* Header row — always visible */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setExpandedHour(isExpanded ? null : hour)}
                                    onKeyDown={e => e.key === 'Enter' && setExpandedHour(isExpanded ? null : hour)}
                                    data-testid={`hour-row-${hour}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.875rem 1rem', cursor: 'pointer',
                                        borderRadius: isExpanded ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                                        userSelect: 'none',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: 38, height: 38, borderRadius: 'var(--radius-md)',
                                            backgroundColor: isExpanded ? 'var(--color-primary)' : 'var(--color-bg-hover)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, transition: 'background-color var(--transition-fast)',
                                        }}>
                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: isExpanded ? '#fff' : 'var(--color-text-primary)' }}>{hour}</span>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>{formatHour(hour)}</p>
                                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>{summary.availableSlots}/{summary.totalSlots} slots · avg ${summary.avgPrice.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {/* Demand badge pinned to header */}
                                        <DemandBadge tier={summary.trafficTier?.key} />
                                        <svg
                                            width="16" height="16" viewBox="0 0 16 16" fill="none"
                                            style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}
                                        >
                                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                </div>

                                {/* Expanded body */}
                                {isExpanded && (
                                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                        {(loopsByHour[hour] || []).map(loop => {
                                            const pricing = pricingService.getSlotPrice(loop.screen_id, selectedDate, hour);
                                            return (
                                                <div key={loop.id} style={{
                                                    padding: '0.875rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    backgroundColor: 'var(--color-bg-hover)',
                                                    border: '1px solid var(--color-border-light)',
                                                }}>
                                                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', marginBottom: '0.625rem', letterSpacing: '0.03em' }}>
                                                        {loop.screen_id}
                                                    </p>
                                                    <SlotStrip
                                                        slots={loop.slots}
                                                        selectedSlots={getLoopSelections(loop.id)}
                                                        pricePerSlot={pricing.price}
                                                        onSlotClick={(i) => handleSlotToggle(loop.id, i)}
                                                    />
                                                    <BookFullLoopBtn
                                                        loop={loop}
                                                        pricePerSlot={pricing.price}
                                                        onBook={() => handleBookFullLoop(loop.id)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Slot legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                {[
                    { bg: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', label: 'Available' },
                    { bg: 'var(--color-primary)',  border: '1.5px solid var(--color-primary)', label: 'Selected' },
                    { bg: 'var(--color-bg-hover)', border: '1px solid var(--color-border-light)', label: 'Booked', opacity: 0.4 },
                ].map(item => (
                    <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 'var(--radius-sm)', backgroundColor: item.bg, border: item.border, flexShrink: 0, opacity: item.opacity }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{item.label}</span>
                    </span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Hover a tile to see price</span>
            </div>

            {/* Sticky footer */}
            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
                backgroundColor: 'var(--color-bg-card)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                padding: '0.875rem 2.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <button
                    onClick={onPrev}
                    style={{
                        height: 38, padding: '0 1.125rem',
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
                        color: 'var(--color-text-primary)', cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                >← Back</button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <PriceSummary
                        totalPrice={totals.totalCost}
                        totalSlots={totals.totalSlots}
                        totalImpressions={totals.totalImpressions}
                    />
                    <button
                        onClick={handleContinue}
                        disabled={selections.length === 0}
                        data-testid="step-3-next-btn"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                            height: 38, padding: '0 1.25rem',
                            backgroundColor: 'var(--color-primary)', color: '#fff',
                            border: 'none', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                            cursor: selections.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: selections.length === 0 ? 0.5 : 1,
                            transition: 'all var(--transition-fast)', boxShadow: 'var(--shadow-md)',
                        }}
                        onMouseEnter={e => { if (selections.length > 0) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    >Upload Creative →</button>
                </div>
            </footer>
        </div>
    );
}

export default Step3LoopSlotSelection;
