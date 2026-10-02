import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import LoopPreview from '../../components/LoopPreview';
import apiClient from '../../services/api';

// Store time zone is projected onto each location by GET /api/locations.
function resolveTimezone(location) {
    return location?.time_zone || location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Task 3.1: build the D-1 date string
function getTomorrowLabel(tz) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: tz,
    });
}

// Task 3.1: dynamic next-hour window label
function getNextHourWindow(tz) {
    const now = new Date();
    const nextHour = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const endHour = new Date(nextHour);
    endHour.setHours(endHour.getHours() + 1);
    const fmt = (d) =>
        d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
    return `${fmt(nextHour)} – ${fmt(endHour)}`;
}

// Nobody approves the schedule: Screens play the generated loops (ADR 0007).
function ScheduleManager() {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [locations, setLocations] = useState([]);
    const [hourlyLoop, setHourlyLoop] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // Task 3.3: full-day is default view
    const [viewMode, setViewMode] = useState('fullday');
    // Full-day slots state (hours 0–23 summary)
    const [daySlots, setDaySlots] = useState([]);

    useEffect(() => {
        fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchLocations = async () => {
        try {
            const data = await apiClient.get(`/api/locations`);
            setLocations(data);
            if (data.length > 0) {
                setSelectedLocation(data[0]);
                fetchLoop(data[0].id, data);
                fetchDaySlots(data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch locations', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLoop = async (locId, locs) => {
        try {
            const allLocs = locs || locations;
            const loc = allLocs.find(l => l.id === locId) || selectedLocation;
            if (!loc || !loc.screen_ids || loc.screen_ids.length === 0) return;

            // Fetch loop for current date and hour (D-1 loop management preview)
            const date = new Date().toISOString().split('T')[0];
            const hour = new Date().getHours();

            const response = await apiClient.get(`/api/loops?location_id=${loc.id}&date=${date}&hour=${hour}`);
            // Find loop for this hour or take the first loop
            const loop = (response.loops || []).find(l => l.hour === hour) || (response.loops || [])[0];
            setHourlyLoop((loop?.slots || []).map(s => ({
                ...s,
                title: s.campaign_id === 'demo-campaign-001' ? 'BonVie Summer Demo' : (s.title || s.asset_name || 'Fallback / Empty Slot'),
                type: s.campaign_id === 'demo-campaign-001' ? 'paid' : (s.type || 'fallback')
            })));
        } catch (error) {
            console.error('Failed to fetch loop preview', error);
        }
    };

    // Task 3.3: fetch or synthesise the full-day 24-hour slot summary
    const fetchDaySlots = async (locId) => {
        try {
            const date = new Date().toISOString().split('T')[0];
            const loops = await apiClient.get(`/api/locations/${locId}/loops?date=${date}`);
            const slots = Array.from({ length: 24 }, (_, h) => {
                const loop = (loops || []).find(l => l.hour === h);
                const hasBonVie = loop && loop.slots && loop.slots.some(s => s.campaign_id === 'demo-campaign-001');
                return {
                    hour: h,
                    generated: Boolean(loop),
                    loopId: loop ? loop.id : `${locId}_h${h}`,
                    slotCount: 12,
                    campaignName: hasBonVie ? 'BonVie Summer Demo' : null
                };
            });
            setDaySlots(slots);
        } catch (error) {
            console.error('Failed to fetch day slots', error);
            setDaySlots(
                Array.from({ length: 24 }, (_, h) => ({
                    hour: h,
                    generated: false,
                    loopId: `${locId}_h${h}`,
                    slotCount: 12,
                }))
            );
        }
    };

    const tz = useMemo(() => resolveTimezone(selectedLocation), [selectedLocation]);
    const dateLabel = useMemo(() => getTomorrowLabel(tz), [tz]);
    const nextHourWindow = useMemo(() => getNextHourWindow(tz), [tz]);

    const formatHour = (h) => {
        const suffix = h >= 12 ? 'PM' : 'AM';
        const disp = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${disp}:00 ${suffix}`;
    };

    if (isLoading) return (
        <div className="animate-pulse space-y-4">
            <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl w-1/3" />
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
    );

    return (
        <div data-testid="schedule-manager" className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Schedule Manager</h1>
                    {/* Task 3.1: dynamic date; Task 3.2: explicit timezone */}
                    <p className="text-slate-500 dark:text-slate-400">
                        D-1 Preview for <strong>{selectedLocation?.name || 'your location'}</strong>
                        {' '}— {dateLabel}
                        {' '}· <span className="font-mono text-xs">{tz}</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Task 3.3: view toggle */}
                    <button
                        onClick={() => setViewMode(v => v === 'fullday' ? 'hourly' : 'fullday')}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {viewMode === 'fullday' ? 'view_timeline' : 'calendar_view_day'}
                        </span>
                        {viewMode === 'fullday' ? 'View Hour Detail' : 'Back to Full Day'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Location Sidebar */}
                <aside data-testid="schedule-store-filter" className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Locations</h3>
                    {locations.map(loc => (
                        <div
                            key={loc.id}
                            onClick={() => {
                                setSelectedLocation(loc);
                                fetchLoop(loc.id, locations);
                                fetchDaySlots(loc.id);
                            }}
                            className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedLocation?.id === loc.id ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                        >
                            <p className="font-bold text-slate-900 dark:text-white">{loc.name}</p>
                            <p className="text-xs text-slate-500">{loc.screen_ids?.length || 0} Screens Active</p>
                        </div>
                    ))}
                </aside>

                {/* Schedule Content */}
                <main className="lg:col-span-3 space-y-8">
                    {viewMode === 'hourly' ? (
                        /* Task 3.3: hourly drill-down (secondary view) */
                        <GlassCard>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    {/* Task 3.1: dynamic hour window */}
                                    <h2 className="text-xl font-bold">Hourly Loop: {nextHourWindow}</h2>
                                    {/* Task 3.1 + 3.2: dynamic date + timezone */}
                                    <p className="text-sm text-slate-500">
                                        Broadcast date {dateLabel} · {tz}
                                    </p>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold ring-1 ring-inset ring-amber-500/20 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                    D-1 Generating
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">view_timeline</span>
                                Loop Breakdown
                            </h3>
                            <LoopPreview slots={hourlyLoop} />
                        </GlassCard>
                    ) : (
                        /* Task 3.3: full-day view (default) */
                        <GlassCard>
                            <h2 className="text-xl font-bold mb-6">Full-Day Schedule — {dateLabel}</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {daySlots.map(slot => (
                                    <div
                                        key={slot.hour}
                                        data-testid="schedule-slot"
                                        className={`p-3 rounded-xl border ${
                                            slot.generated
                                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                                                : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                                        }`}
                                    >
                                        <p className="text-xs font-bold text-slate-500 mb-1">{formatHour(slot.hour)}</p>
                                        <p data-testid={`loop-generated-${slot.hour}`} className={`text-sm font-semibold ${
                                            slot.generated ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                                        }`}>{slot.generated ? 'Generated' : 'Not generated'}</p>
                                        {slot.campaignName && (
                                            <p className="text-xs font-semibold text-primary mt-1">{slot.campaignName}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    )}

                    {/* Stats cards — still displayed in both view modes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ad Frequency</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">60x / Hour</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Weight</p>
                            <p className="text-2xl font-black text-primary">8.33%</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Safety Lock</p>
                            <p className="text-2xl font-black text-emerald-500">Enabled</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default ScheduleManager;
