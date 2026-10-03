import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import LoopPreview from '../../components/LoopPreview';
import apiClient from '../../services/api';
import { formatHour, hourInTimeZone, tomorrowInTimeZone } from './storeTime';

// Store time zone is projected onto each location by GET /api/locations.
function resolveTimezone(location) {
    return location?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Task 3.1: the D-1 broadcast date, e.g. "Wednesday 16 Jan"
function formatBroadcastDate(date) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    });
}

// "09" for 9 AM; hour 24 is the next midnight, "00".
const twoDigitHour = (h) => String(h % 24).padStart(2, '0');

// Nobody approves the schedule: Screens play the generated loops (ADR 0007).
function ScheduleManager() {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [locations, setLocations] = useState([]);
    // Tomorrow's loops for the selected Location's Store; generated loops are keyed by Store.
    const [loops, setLoops] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    // Task 3.3: full-day is default view
    const [viewMode, setViewMode] = useState('fullday');

    useEffect(() => {
        apiClient.get('/api/locations')
            .then(data => {
                setLocations(data);
                setSelectedLocation(data[0] || null);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, []);

    const tz = useMemo(() => resolveTimezone(selectedLocation), [selectedLocation]);
    const broadcastDate = useMemo(() => tomorrowInTimeZone(tz), [tz]);
    const dateLabel = formatBroadcastDate(broadcastDate);
    const nextHour = useMemo(() => (hourInTimeZone(tz) + 1) % 24, [tz]);

    useEffect(() => {
        if (!selectedLocation) return undefined;
        let active = true;
        setLoops([]);
        setError('');
        apiClient.get(`/api/loops/review/${selectedLocation.store_id}/${broadcastDate}`)
            .then(data => { if (active) setLoops(data.loops || []); })
            .catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [selectedLocation, broadcastDate]);

    const loopAt = (hour) => loops.find(loop => loop.hour === hour);
    const nextHourLoop = loopAt(nextHour);

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

            {error && (
                <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Location Sidebar */}
                <aside data-testid="schedule-store-filter" className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Locations</h3>
                    {!error && locations.length === 0 && (
                        <p className="px-2 text-sm text-slate-500">No Locations to preview.</p>
                    )}
                    {locations.map(loc => (
                        <button
                            key={loc.id}
                            onClick={() => setSelectedLocation(loc)}
                            className={`w-full text-left p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedLocation?.id === loc.id ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                        >
                            <p className="font-bold text-slate-900 dark:text-white">{loc.name}</p>
                            <p className="text-xs text-slate-500">{loc.screen_ids?.length || 0} Screens Active</p>
                        </button>
                    ))}
                </aside>

                {/* Schedule Content */}
                <main className="lg:col-span-3 space-y-8">
                    {viewMode === 'hourly' ? (
                        /* Task 3.3: hourly drill-down (secondary view) */
                        <GlassCard>
                            <div className="mb-8">
                                {/* Task 3.1: dynamic hour window */}
                                <h2 className="text-xl font-bold">Hourly Loop: {twoDigitHour(nextHour)}:00 – {twoDigitHour(nextHour + 1)}:00</h2>
                                {/* Task 3.1 + 3.2: dynamic date + timezone */}
                                <p className="text-sm text-slate-500">
                                    Broadcast date {dateLabel} · {tz}
                                </p>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">view_timeline</span>
                                Loop Breakdown
                            </h3>
                            {nextHourLoop ? (
                                <LoopPreview slots={nextHourLoop.slots || []} />
                            ) : (
                                <p className="text-sm text-slate-500">No loop generated for this hour.</p>
                            )}
                        </GlassCard>
                    ) : (
                        /* Task 3.3: full-day view (default) */
                        <GlassCard>
                            <h2 className="text-xl font-bold mb-6">Full-Day Schedule — {dateLabel}</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {Array.from({ length: 24 }, (_, hour) => {
                                    const generated = Boolean(loopAt(hour));
                                    return (
                                        <div
                                            key={hour}
                                            data-testid="schedule-slot"
                                            className={`p-3 rounded-xl border ${
                                                generated
                                                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                                            }`}
                                        >
                                            <p className="text-xs font-bold text-slate-500 mb-1">{formatHour(hour)}</p>
                                            <p data-testid={`loop-generated-${hour}`} className={`text-sm font-semibold ${
                                                generated ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                                            }`}>{generated ? 'Generated' : 'Not generated'}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    )}
                </main>
            </div>
        </div>
    );
}

export default ScheduleManager;
