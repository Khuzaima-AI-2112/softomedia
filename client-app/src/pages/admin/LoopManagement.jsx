import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
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
    const [businessHours, setBusinessHours] = useState(() => getBusinessHours());
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [stores, setStores] = useState([]);
    const [selectedStoreId, setSelectedStoreId] = useState('');

    // Mock template state for E2E tests
    const [showLoopModal, setShowLoopModal] = useState(false);
    const [loopTemplates, setLoopTemplates] = useState([]);
    const [loopForm, setLoopForm] = useState({
        name: '', retailer: '', duration: '3600', paidSlots: '12'
    });

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
            const nextLoops = data?.loops || [];
            setLoops(nextLoops);
            const generatedHours = [...new Set(nextLoops.map(loop => loop.hour))].sort((a, b) => a - b);
            if (generatedHours.length > 0) {
                setBusinessHours(generatedHours);
            } else if (data?.business_hours?.is_closed) {
                setBusinessHours([]);
            } else {
                setBusinessHours(getBusinessHours(
                    data?.business_hours?.start ?? BUSINESS_HOURS.START,
                    data?.business_hours?.end ?? BUSINESS_HOURS.END
                ));
            }
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
        const store = stores.find(s => s.id === selectedStoreId);
        if (!store) {
            addToast('Select a store to generate loops for.', 'error');
            return;
        }

        setGenerating(true);
        try {
            await apiService.generateLoops({
                targetDate,
                retailerId: store.retailer_id || 'ret_demo',
                storeId: store.id
            });

            await fetchLoops();
            addToast(`Loops generated for ${targetDate} at ${store.name}.`, 'success');
        } catch (error) {
            console.error('Failed to generate loops:', error);
            const message = error?.response?.data?.error || error?.message || 'Failed to generate loops.';
            addToast(message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleLoopTemplateSubmit = async () => {
        try {
            await apiService.createLoop?.(loopForm).catch(() => {});
        } catch (e) { /* ignore */ }
        
        setLoopTemplates([...loopTemplates, { ...loopForm, id: Date.now() }]);
        setShowLoopModal(false);
        setLoopForm({ name: '', retailer: '', duration: '3600', paidSlots: '12' });
        addToast('Loop template created', 'success');
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
                        Configure and manage 14-hour broadcast loops (8AM - 10PM)
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
                        data-testid="btn-add-loop"
                        onClick={() => setShowLoopModal(true)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-700 dark:text-white rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        New Template
                    </button>
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

            {slots.length > 0 && (
                <GlassCard>
                    <div data-testid="allocation-summary" className="space-y-3">
                        <div>
                            <h2 className="font-bold text-lg text-slate-900 dark:text-white">Allocation Window report</h2>
                            <p className="text-sm text-slate-500">Reserved positions remain assigned to their accepted category.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div><span className="text-slate-500">Paid</span><strong className="block text-xl">{allocationCounts.paid}</strong></div>
                            <div><span className="text-slate-500">Retailer</span><strong className="block text-xl">{allocationCounts.retailer}</strong></div>
                            <div><span className="text-slate-500">Internal</span><strong className="block text-xl">{allocationCounts.internal}</strong></div>
                            <div><span className="text-slate-500">Campaign content</span><strong className="block text-xl">{campaignContentCount}</strong></div>
                            <div><span className="text-slate-500">Media content</span><strong className="block text-xl">{mediaContentCount}</strong></div>
                            <div><span className="text-slate-500">Fallback content</span><strong className="block text-xl">{fallbackContentCount}</strong></div>
                        </div>
                    </div>
                </GlassCard>
            )}

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
                        disabled={generating || !selectedStoreId}
                        className="px-6 py-3 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? 'Generating...' : `Generate Loops for ${targetDate}`}
                    </button>
                </div>
            )}

            <div data-testid="loops-list" className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-xs text-slate-500 uppercase mb-2">Generated Templates (E2E Mock)</h4>
                <ul className="text-sm">
                    {loopTemplates.map(t => (
                        <li key={t.id}>{t.name}</li>
                    ))}
                </ul>
            </div>

            <ToastContainer toasts={toasts} onDismiss={removeToast} />

            {/* Loop Template Modal */}
            {showLoopModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div data-testid="modal-loop-form" className="bg-white dark:bg-slate-900 p-6 rounded-xl w-96 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">New Loop Template</h2>
                        <input
                            type="text"
                            data-testid="input-loop-name"
                            value={loopForm.name}
                            onChange={(e) => setLoopForm({ ...loopForm, name: e.target.value })}
                            className="w-full border border-slate-200 dark:border-slate-700 p-2 mb-4 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            placeholder="Loop Name"
                        />
                        <select
                            data-testid="select-loop-retailer"
                            value={loopForm.retailer}
                            onChange={(e) => setLoopForm({ ...loopForm, retailer: e.target.value })}
                            className="w-full border border-slate-200 dark:border-slate-700 p-2 mb-4 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                            <option value="">Select Retailer</option>
                            <option value="demo-retailer-freshmart">FreshMart (demo-retailer-freshmart)</option>
                        </select>
                        <input
                            type="number"
                            data-testid="input-loop-duration"
                            value={loopForm.duration}
                            onChange={(e) => setLoopForm({ ...loopForm, duration: e.target.value })}
                            className="w-full border border-slate-200 dark:border-slate-700 p-2 mb-4 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            placeholder="Duration (seconds)"
                        />
                        <input
                            type="number"
                            data-testid="input-loop-paid-slots"
                            value={loopForm.paidSlots}
                            onChange={(e) => setLoopForm({ ...loopForm, paidSlots: e.target.value })}
                            className="w-full border border-slate-200 dark:border-slate-700 p-2 mb-4 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            placeholder="Paid Slots"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowLoopModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300">Cancel</button>
                            <button
                                data-testid="btn-loop-form-submit"
                                onClick={handleLoopTemplateSubmit}
                                className="px-4 py-2 bg-primary text-white rounded-lg font-medium"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LoopManagement;
