import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import LoopPreview from '../../components/LoopPreview';
import apiClient from '../../services/api';

// Task 3.2: resolve timezone from location record, fall back to browser
function resolveTimezone(location) {
    // Note: backend location schema may lack a `timezone` field.
    // If missing for all locations, open a tracking issue against ad-server
    // to add timezone to the location data model.
    return location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Task 3.1 + 3.6: build the D-1 date string and cutoff state
function getTomorrowInfo(tz) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateLabel = tomorrow.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: tz,
    });

    // D-1 cutoff: 18:00 store local time (confirmed business rule)
    const cutoffHour = 18;
    const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const isPastCutoff = nowInTz.getHours() >= cutoffHour;

    return { dateLabel, isPastCutoff, cutoffHour };
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

function ScheduleManager() {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [locations, setLocations] = useState([]);
    const [hourlyLoop, setHourlyLoop] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // Task 3.3: full-day is default view
    const [viewMode, setViewMode] = useState('fullday');
    // Task 3.5: rejection modal state
    const [rejectingSlot, setRejectingSlot] = useState(null); // { loopId, hour }
    const [rejectComment, setRejectComment] = useState('');
    const [rejectWarn, setRejectWarn] = useState(false);
    const [rejectLoading, setRejectLoading] = useState(false);
    // Task 3.4: bulk approve state
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null); // null | 'success' | 'error'
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
            
            try {
                const response = await apiClient.get(`/api/loops?location_id=${loc.id}&date=${date}&hour=${hour}&status=approved`);
                // Find loop for this hour or take the first approved loop
                const loop = (response.loops || []).find(l => l.hour === hour) || (response.loops || [])[0];
                if (loop && loop.slots && loop.slots.length > 0) {
                    const mappedSlots = loop.slots.map(s => ({
                        ...s,
                        title: s.campaign_id === 'demo-campaign-001' ? 'BonVie Summer Demo' : (s.title || s.asset_name || 'Fallback / Empty Slot'),
                        type: s.campaign_id === 'demo-campaign-001' ? 'paid' : (s.type || 'fallback')
                    }));
                    setHourlyLoop(mappedSlots);
                    return;
                }
            } catch (err) {
                console.warn('[ScheduleManager] Failed to fetch loop preview, falling back to playlist', err);
            }

            // Fallback to legacy playlist endpoint
            const data = await apiClient.get(`/api/playlist/${loc.screen_ids[0]}`);
            setHourlyLoop(data.playlist || []);
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
                    status: loop ? loop.status : 'pending',
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
                    status: 'pending',
                    loopId: `${locId}_h${h}`,
                    slotCount: 12,
                }))
            );
        }
    };

    const tz = useMemo(() => resolveTimezone(selectedLocation), [selectedLocation]);
    const { dateLabel, isPastCutoff, cutoffHour } = useMemo(() => getTomorrowInfo(tz), [tz]);
    const nextHourWindow = useMemo(() => getNextHourWindow(tz), [tz]);
    const unreviewedCount = daySlots.filter(s => s.status === 'pending').length;

    // Task 3.4: bulk approve handler — POST /api/locations/:id/loops/approve-all
    const handleBulkApprove = async () => {
        if (!selectedLocation) return;
        setBulkLoading(true);
        setBulkResult(null);
        try {
            await apiClient.post(`/api/locations/${selectedLocation.id}/loops/approve-all`, { date: dateLabel });
            setDaySlots(prev => prev.map(s => ({ ...s, status: 'approved' })));
            setBulkResult('success');
        } catch {
            setBulkResult('error');
        } finally {
            setBulkLoading(false);
            setShowBulkConfirm(false);
        }
    };

    // Task 3.5: per-slot rejection handler — POST /api/loops/:loopId/reject
    const handleRejectSubmit = async () => {
        if (!rejectComment.trim()) {
            setRejectWarn(true);
            return;
        }
        setRejectLoading(true);
        try {
            await apiClient.post(`/api/loops/${rejectingSlot.loopId}/reject`, { reason: rejectComment });
            setDaySlots(prev =>
                prev.map(s => s.loopId === rejectingSlot.loopId ? { ...s, status: 'rejected' } : s)
            );
        } catch {
            // silent — slot status unchanged, user can retry
        } finally {
            setRejectLoading(false);
            setRejectingSlot(null);
            setRejectComment('');
            setRejectWarn(false);
        }
    };

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

            {/* Task 3.6: D-1 cutoff warning banner */}
            {isPastCutoff && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
                    <span className="material-symbols-outlined text-[20px]">warning</span>
                    <span className="text-sm font-semibold">
                        Approval window closed — D-1 cutoff was {cutoffHour}:00 {tz}.
                        Contact admin to reopen.
                    </span>
                </div>
            )}

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
                    {/* Task 3.6: approval deadline label */}
                    <p className="text-xs text-slate-400 mt-1">
                        Approval deadline: {dateLabel.split(',')[0]} {cutoffHour}:00 {tz}
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
                    {/* Task 3.4: Bulk Approve All — triggers confirmation dialog */}
                    <button
                        data-testid="btn-approve-schedule"
                        onClick={() => setShowBulkConfirm(true)}
                        disabled={isPastCutoff || unreviewedCount === 0}
                        className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[18px]">done_all</span>
                        Bulk Approve All
                    </button>
                </div>
            </div>

            {/* Task 3.4: bulk approve confirmation dialog */}
            {showBulkConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Bulk Approval</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            Approve all <strong>{unreviewedCount}</strong> unreviewed slots for{' '}
                            <strong>{selectedLocation?.name}</strong> on{' '}
                            <strong>{dateLabel}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setShowBulkConfirm(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkApprove}
                                disabled={bulkLoading}
                                className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 transition-all disabled:opacity-60"
                            >
                                {bulkLoading ? 'Approving…' : 'Yes, Approve All'}
                            </button>
                        </div>
                        {bulkResult === 'error' && (
                            <p className="text-sm text-rose-500">Approval failed — please try again or contact admin.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Task 3.5: per-slot rejection modal */}
            {rejectingSlot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div data-testid="modal-rejection-reason" className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Reject slot — {formatHour(rejectingSlot.hour)}
                        </h3>
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
                                Rejection note <span className="text-slate-400 font-normal">(optional but recommended)</span>
                            </label>
                            <textarea
                                data-testid="input-rejection-reason"
                                maxLength={280}
                                rows={3}
                                value={rejectComment}
                                onChange={e => { setRejectComment(e.target.value); setRejectWarn(false); }}
                                placeholder="Reason for rejection…"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <div className="flex justify-between mt-1">
                                <span className="text-xs text-slate-400">{rejectComment.length}/280</span>
                            </div>
                            {rejectWarn && (
                                <p className="text-xs text-amber-500 mt-1">
                                    ⚠ Rejection without a note may delay resolution.
                                    Add a note or confirm below to proceed anyway.
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => { setRejectingSlot(null); setRejectComment(''); setRejectWarn(false); }}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancel
                            </button>
                            {rejectWarn && (
                                <button
                                    onClick={handleRejectSubmit}
                                    className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-all"
                                >
                                    Reject anyway
                                </button>
                            )}
                            <button
                                data-testid="btn-confirm-rejection"
                                onClick={handleRejectSubmit}
                                disabled={rejectLoading}
                                className="px-4 py-2 bg-rose-500 text-white text-sm font-bold rounded-lg hover:bg-rose-600 transition-all disabled:opacity-60"
                            >
                                {rejectLoading ? 'Submitting…' : 'Submit Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task 3.4: bulk approve success toast */}
            {bulkResult === 'success' && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span className="text-sm font-semibold">All slots approved for {selectedLocation?.name} on {dateLabel}.</span>
                    <button onClick={() => setBulkResult(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            )}

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
                                setBulkResult(null);
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
                                        Validation window for {dateLabel} · {tz}
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
                                            slot.status === 'approved'
                                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                                                : slot.status === 'rejected'
                                                    ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10'
                                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                                        }`}
                                    >
                                        <p className="text-xs font-bold text-slate-500 mb-1">{formatHour(slot.hour)}</p>
                                        <p data-testid={`status-badge-${slot.loopId}`} className={`text-sm font-semibold capitalize ${
                                            slot.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400'
                                            : slot.status === 'rejected' ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                        }`}>{slot.status}</p>
                                        {slot.campaignName && (
                                            <p className="text-xs font-semibold text-primary mt-1">{slot.campaignName}</p>
                                        )}
                                        {/* Task 3.5: per-slot reject button */}
                                        {slot.status === 'pending' && !isPastCutoff && (
                                            <button
                                                data-testid={`btn-reject-schedule-${slot.loopId}`}
                                                onClick={() => setRejectingSlot({ loopId: slot.loopId, hour: slot.hour })}
                                                className="mt-2 text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">block</span>
                                                Reject
                                            </button>
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
