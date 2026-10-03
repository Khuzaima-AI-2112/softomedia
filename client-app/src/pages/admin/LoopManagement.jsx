import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';
import { ToastContainer, useToasts } from '../../components/Toast';

const BUSINESS_HOURS = { START: 8, END: 22 };

const getBusinessHours = (start = BUSINESS_HOURS.START, end = BUSINESS_HOURS.END) => {
    const hours = [];
    for (let h = start; h < end; h++) hours.push(h);
    return hours;
};

const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

function LoopManagement() {
    const navigate = useNavigate();
    const [targetDate, setTargetDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [loops, setLoops] = useState([]);
    const [businessHours, setBusinessHours] = useState(() => getBusinessHours());
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [stores, setStores] = useState([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    const { toasts, addToast, removeToast } = useToasts();

    // Loops are generated and reviewed per store — an Admin manages one
    // store's broadcast schedule at a time, matching how a Retailer only
    // ever sees its own store's loops.
    useEffect(() => {
        apiService.getStores().then(data => {
            const list = data?.stores || data || [];
            setStores(list);
            setSelectedStoreId(prev => prev || list[0]?.id || '');
        }).catch(error => {
            console.error('Failed to fetch stores:', error);
        });
    }, []);

    const fetchLoops = useCallback(async () => {
        if (!selectedStoreId) {
            setLoops([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await apiService.getLoopsByDate(targetDate, selectedStoreId);
            const nextLoops = data.loops || [];
            setLoops(nextLoops);
            // Every opening hour, plus any hour that already has a loop: an hour the
            // Store opened after its loops were generated must still show as missing.
            const openingHours = data.business_hours?.is_closed
                ? []
                : getBusinessHours(
                    data.business_hours?.start ?? BUSINESS_HOURS.START,
                    data.business_hours?.end ?? BUSINESS_HOURS.END
                );
            const hours = new Set([...openingHours, ...nextLoops.map(loop => loop.hour)]);
            setBusinessHours([...hours].sort((a, b) => a - b));
        } catch (error) {
            console.error('Failed to fetch loops:', error);
            addToast('Failed to load loops. Please refresh.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, targetDate, selectedStoreId]);

    useEffect(() => {
        fetchLoops();
    }, [fetchLoops]);

    const handleGenerate = async () => {
        // Both Generate buttons are disabled until a Store is selected.
        const store = stores.find(s => s.id === selectedStoreId);
        setGenerating(true);
        try {
            await apiService.generateLoops({
                targetDate,
                retailerId: store.retailer_id,
                storeId: store.id
            });

            await fetchLoops();
            addToast(`Loops generated for ${targetDate} at ${store.name}.`, 'success');
        } catch (error) {
            console.error('Failed to generate loops:', error);
            addToast(error.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const getLoopForHour = (hour) => loops.find(l => l.hour === hour) || null;

    // Task 7.6: Warn if any upcoming hours have no loop; nobody approves one (ADR 0007).
    // "Upcoming" = current hour and later (for today), or all hours (for future dates).
    const getUpcomingHoursWithoutLoop = () => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const isToday = targetDate === todayStr;
        const currentHour = now.getHours();

        return businessHours.filter(hour => {
            // For today: only warn about current + future hours
            if (isToday && hour < currentHour) return false;
            return !getLoopForHour(hour);
        });
    };

    const hoursWithoutLoop = !loading ? getUpcomingHoursWithoutLoop() : [];
    const slots = loops.flatMap(loop => loop.slots || []);
    const allocationCounts = slots.reduce((counts, slot) => {
        const category = slot.allocated_category;
        if (category) counts[category] = (counts[category] || 0) + 1;
        return counts;
    }, { paid: 0, retailer: 0, internal: 0 });
    const campaignContentCount = slots.filter(slot => slot.content_kind === 'campaign' && !slot.is_fallback).length;
    const mediaContentCount = slots.filter(slot => slot.content_kind === 'media' && !slot.is_fallback).length;
    const fallbackContentCount = slots.filter(slot => slot.content_kind === 'fallback' || slot.is_fallback).length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Loop Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Generate and review the Hourly Loops of a Store, one for each opening hour of a day
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedStoreId}
                        onChange={(e) => setSelectedStoreId(e.target.value)}
                        aria-label="Target store for loop generation"
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        data-testid="loop-store-picker"
                    >
                        {stores.length === 0 && <option value="">No stores found</option>}
                        {stores.map(store => (
                            <option key={store.id} value={store.id}>{store.name}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        aria-label="Target date for loop generation"
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        data-testid="loop-date-picker"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !selectedStoreId}
                        aria-label={generating ? 'Generating loops...' : `Generate loops for ${targetDate}`}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="generate-loops-btn"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {generating ? 'progress_activity' : 'auto_fix_high'}
                        </span>
                        {generating ? 'Generating...' : 'Generate Loops'}
                    </button>
                </div>
            </div>

            {/* Task 7.6: upcoming hours without a loop warning banner */}
            {hoursWithoutLoop.length > 0 && (
                <div
                    role="alert"
                    data-testid="hours-without-loop-banner"
                    className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                >
                    <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">warning</span>
                    <div>
                        <p className="font-semibold text-sm">
                            {hoursWithoutLoop.length} upcoming hour{hoursWithoutLoop.length !== 1 ? 's' : ''} without a loop
                        </p>
                        <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                            Screens may play fallback content during:{' '}
                            {hoursWithoutLoop.map(h => formatHour(h)).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassCard className="border-l-4 border-l-primary" role="group" aria-label="Total Hours">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Hours</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{businessHours.length}</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500" role="group" aria-label="Loops Generated">
                    <p className="text-sm font-medium text-slate-500 mb-1">Loops Generated</p>
                    <p className="text-3xl font-bold text-emerald-500">{loops.length}</p>
                </GlassCard>
            </div>

            {slots.length > 0 && (
                <GlassCard>
                    <section data-testid="allocation-summary" aria-labelledby="allocation-summary-title" className="space-y-3">
                        <div>
                            <h2 id="allocation-summary-title" className="font-bold text-lg text-slate-900 dark:text-white">Allocation Window report</h2>
                            <p className="text-sm text-slate-500">Reserved positions remain assigned to their accepted category.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            {[
                                ['Paid', allocationCounts.paid],
                                ['Retailer', allocationCounts.retailer],
                                ['Internal', allocationCounts.internal],
                                ['Campaign content', campaignContentCount],
                                ['Media content', mediaContentCount],
                                ['Fallback content', fallbackContentCount],
                            ].map(([label, count]) => (
                                <div key={label} role="group" aria-label={label}>
                                    <span className="text-slate-500">{label}</span><strong className="block text-xl">{count}</strong>
                                </div>
                            ))}
                        </div>
                    </section>
                </GlassCard>
            )}

            {/* Hourly Loop grid */}
            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">schedule</span>
                        Hourly Loop Grid — {new Date(targetDate).toLocaleDateString('en-US', {
                            timeZone: 'UTC',
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </h3>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-primary"></span> Filled
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-slate-400"></span> Empty
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-500 animate-pulse">
                        Loading loops...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-3" data-testid="loop-grid">
                        {businessHours.map(hour => {
                            const loop = getLoopForHour(hour);
                            const filledSlots = loop?.slots?.filter(s => s.asset_id).length || 0;

                            return (
                                <div
                                    key={hour}
                                    className={`p-4 rounded-xl border transition-all text-left ${loop
                                            ? 'border-slate-200 dark:border-slate-700'
                                            : 'border-dashed border-slate-300 dark:border-slate-700 opacity-50'
                                        }`}
                                    role="group"
                                    aria-label={formatHour(hour)}
                                    data-testid={`loop-hour-${hour}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                            {formatHour(hour)}
                                        </span>
                                    </div>

                                    {loop ? (
                                        <>
                                            <div className="text-xs text-slate-500 mb-2">
                                                {filledSlots}/12 slots filled
                                            </div>
                                            <div className="flex gap-0.5 mb-3">
                                                {Array.from({ length: 12 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1.5 flex-1 rounded-full ${loop.slots?.[i]?.asset_id
                                                                ? 'bg-primary'
                                                                : 'bg-slate-200 dark:bg-slate-700'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => navigate(`/dashboard/admin/loops/${loop.id}`)}
                                                aria-label={`Edit loop for ${formatHour(hour)}`}
                                                className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                                                data-testid={`edit-loop-btn-${hour}`}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                                Edit Loop
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">
                                            No loop generated
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>

            {/* Empty State */}
            {!loading && loops.length === 0 && (
                <div data-testid="no-data-state" className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">calendar_month</span>
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">
                        No Loops Generated
                    </h3>
                    <p className="text-slate-500 mb-6">
                        Generate loops for {targetDate} to start scheduling ads.
                    </p>
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !selectedStoreId}
                        className="px-6 py-3 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? 'Generating...' : `Generate Loops for ${targetDate}`}
                    </button>
                </div>
            )}

            <ToastContainer toasts={toasts} onDismiss={removeToast} />

        </div>
    );
}

export default LoopManagement;
