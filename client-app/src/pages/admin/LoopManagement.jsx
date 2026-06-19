import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiService from '../../services/ApiService';
import { ToastContainer, useToasts } from '../../components/Toast';

const BUSINESS_HOURS = { START: 8, END: 22 };

const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) hours.push(h);
    return hours;
};

const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

const getStatusColor = (status) => {
    switch (status) {
        case 'APPROVED': return 'bg-emerald-500';
        case 'PENDING_APPROVAL': return 'bg-amber-500';
        case 'REJECTED': return 'bg-red-500';
        case 'LIVE': return 'bg-blue-500';
        default: return 'bg-slate-400';
    }
};

function LoopManagement() {
    const navigate = useNavigate();
    const [targetDate, setTargetDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [loops, setLoops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const { toasts, addToast, removeToast } = useToasts();
    const businessHours = getBusinessHours();

    const fetchLoops = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiService.getLoopsByDate(targetDate);
            setLoops(data?.loops || []);
        } catch (error) {
            console.error('Failed to fetch loops:', error);
            addToast('Failed to load loops. Please refresh.', 'error');
        } finally {
            setLoading(false);
        }
    }, [targetDate]);

    useEffect(() => {
        fetchLoops();
    }, [fetchLoops]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const stores = await apiService.getStores();
            if (!stores || stores.length === 0) {
                addToast('No stores found in the system to generate loops for.', 'error');
                setGenerating(false);
                return;
            }

            // Fire loop generation for all stores simultaneously
            await Promise.all(stores.map(store =>
                apiService.generateLoops({
                    targetDate,
                    retailerId: store.retailer_id || 'ret_demo',
                    locationId: store.id,
                    mock: true
                }).catch(err => {
                    console.error(`Failed generating for store ${store.id}:`, err);
                })
            ));

            await fetchLoops();
            addToast(`Loops generated for ${targetDate} across all stores.`, 'success');
        } catch (error) {
            console.error('Failed to generate loops:', error);
            const message = error?.response?.data?.error || error?.message || 'Failed to generate loops.';
            addToast(message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const getLoopForHour = (hour) => loops.find(l => l.hour === hour) || null;

    // Task 7.6: Warn if any upcoming hours today have no approved loop.
    // "Upcoming" = current hour and later (for today), or all hours (for future dates).
    const getUnapprovedUpcomingHours = () => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const isToday = targetDate === todayStr;
        const currentHour = now.getHours();

        return businessHours.filter(hour => {
            // For today: only warn about current + future hours
            if (isToday && hour < currentHour) return false;
            const loop = getLoopForHour(hour);
            // Warn if no loop exists OR loop is not APPROVED
            return !loop || loop.status !== 'APPROVED';
        });
    };

    const unapprovedHours = !loading ? getUnapprovedUpcomingHours() : [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Loop Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Configure and manage 14-hour broadcast loops (8AM - 10PM)
                    </p>
                </div>
                <div className="flex items-center gap-3">
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
                        disabled={generating}
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

            {/* Task 7.6: Unapproved upcoming hours warning banner */}
            {unapprovedHours.length > 0 && (
                <div
                    data-testid="unapproved-hours-banner"
                    className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                >
                    <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">warning</span>
                    <div>
                        <p className="font-semibold text-sm">
                            {unapprovedHours.length} upcoming hour{unapprovedHours.length !== 1 ? 's' : ''} without an approved loop
                        </p>
                        <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                            Screens may play fallback content during:{' '}
                            {unapprovedHours.map(h => formatHour(h)).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Hours</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{businessHours.length}</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Approved</p>
                    <p className="text-3xl font-bold text-emerald-500">
                        {loops.filter(l => l.status === 'APPROVED').length}
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Pending</p>
                    <p className="text-3xl font-bold text-amber-500">
                        {loops.filter(l => l.status === 'PENDING_APPROVAL').length}
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-red-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Rejected</p>
                    <p className="text-3xl font-bold text-red-500">
                        {loops.filter(l => l.status === 'REJECTED').length}
                    </p>
                </GlassCard>
            </div>

            {/* 14-Hour Grid */}
            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">schedule</span>
                        Hourly Loop Grid — {new Date(targetDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </h3>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Approved
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Pending
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
                                    data-testid={`loop-hour-${hour}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                            {formatHour(hour)}
                                        </span>
                                        {/* Task 7.6: status dot + StatusBadge inline */}
                                        {loop && (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(loop.status)}`}></span>
                                                <StatusBadge status={loop.status} size="xs" />
                                            </div>
                                        )}
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
                                                                ? loop.slots[i].status === 'REJECTED'
                                                                    ? 'bg-red-400'
                                                                    : 'bg-primary'
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
                        disabled={generating}
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
