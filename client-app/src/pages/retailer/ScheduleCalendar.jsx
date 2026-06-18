/**
 * Schedule Calendar Page
 * Retailer interface for previewing and approving tomorrow's broadcast schedule
 * Business Hours: 8am - 10pm (14 loops per day)
 *
 * Sprint 11 — S11-5: data-testid="schedule-calendar-container" added to root div.
 */

import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import LoopPreviewModal from '../../components/LoopPreviewModal';
import { API_URL } from '../../config';

// Business hours configuration
const BUSINESS_HOURS = {
    START: 8,
    END: 22
};

// Generate business hours array
const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) {
        hours.push(h);
    }
    return hours;
};

// Format hour to display string
const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

// Get status styling
const getStatusStyle = (status) => {
    switch (status) {
        case 'APPROVED': return 'bg-emerald-500/10 border-emerald-500 text-emerald-600';
        case 'PENDING_APPROVAL': return 'bg-amber-500/10 border-amber-500 text-amber-600';
        case 'REJECTED': return 'bg-red-500/10 border-red-500 text-red-600';
        default: return 'bg-slate-100 border-slate-300 text-slate-500';
    }
};

function ScheduleCalendar() {
    // Get tomorrow's date
    const [targetDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    const [loops, setLoops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLoop, setSelectedLoop] = useState(null);
    const [approving, setApproving] = useState(false);

    const businessHours = getBusinessHours();

    useEffect(() => {
        fetchLoops();
    }, [targetDate]);

    const fetchLoops = async () => {
        setLoading(true);
        try {
            // 🔶 TODO: Filter by retailer_id from auth context
            const res = await fetch(`${API_URL}/api/loops?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                setLoops(data.loops || []);
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const getLoopForHour = (hour) => {
        return loops.find(l => l.hour === hour) || null;
    };

    const handleApproveAll = async () => {
        setApproving(true);
        try {
            // Approve all pending loops
            const pending = loops.filter(l => l.status === 'PENDING_APPROVAL');
            for (const loop of pending) {
                await fetch(`${API_URL}/api/loops/${loop.id}/approve`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: 'retailer_demo' }) // 🔶 TODO: Get from auth
                });
            }
            await fetchLoops();
        } catch (error) {
            console.error('Failed to approve loops:', error);
        } finally {
            setApproving(false);
        }
    };

    const handleLoopClick = (loop) => {
        if (loop) {
            setSelectedLoop(loop);
        }
    };

    const handleModalClose = () => {
        setSelectedLoop(null);
        fetchLoops(); // Refresh after potential changes
    };

    const pendingCount = loops.filter(l => l.status === 'PENDING_APPROVAL').length;
    const approvedCount = loops.filter(l => l.status === 'APPROVED').length;
    const rejectedCount = loops.filter(l => l.status === 'REJECTED').length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500" data-testid="schedule-calendar-container">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Tomorrow&apos;s Broadcast Schedule
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Review and approve the broadcast schedule for{' '}
                        <span className="font-semibold text-primary">
                            {new Date(targetDate).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </span>
                    </p>
                </div>
                {pendingCount > 0 && (
                    <button
                        onClick={handleApproveAll}
                        disabled={approving}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50"
                        data-testid="approve-all-btn"
                    >
                        <span className="material-symbols-outlined">check_circle</span>
                        {approving ? 'Approving...' : `Approve All (${pendingCount})`}
                    </button>
                )}
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Hours</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{businessHours.length}</p>
                    <p className="text-xs text-slate-400 mt-1">8AM - 10PM</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Pending Review</p>
                    <p className="text-3xl font-bold text-amber-500">{pendingCount}</p>
                    <p className="text-xs text-slate-400 mt-1">Requires your approval</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Approved</p>
                    <p className="text-3xl font-bold text-emerald-500">{approvedCount}</p>
                    <p className="text-xs text-slate-400 mt-1">Ready to broadcast</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-red-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Needs Attention</p>
                    <p className="text-3xl font-bold text-red-500">{rejectedCount}</p>
                    <p className="text-xs text-slate-400 mt-1">Rejected ads need replacement</p>
                </GlassCard>
            </div>

            {/* Timeline View */}
            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">calendar_today</span>
                        Hourly Schedule Timeline
                    </h3>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Approved
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Pending
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span> Rejected
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-500 animate-pulse">
                        Loading schedule...
                    </div>
                ) : (
                    <div className="space-y-2" data-testid="schedule-timeline">
                        {businessHours.map(hour => {
                            const loop = getLoopForHour(hour);
                            const rejectedSlots = loop?.slots?.filter(s => s.status === 'REJECTED').length || 0;

                            return (
                                <button
                                    key={hour}
                                    onClick={() => handleLoopClick(loop)}
                                    disabled={!loop}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${loop
                                        ? `${getStatusStyle(loop.status)} hover:shadow-md cursor-pointer`
                                        : 'bg-slate-50 dark:bg-slate-800 border-dashed border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                                        }`}
                                    data-testid={`schedule-hour-${hour}`}
                                >
                                    {/* Time */}
                                    <div className="w-24 text-left">
                                        <span className="text-lg font-bold">{formatHour(hour)}</span>
                                    </div>

                                    {/* Loop Preview Bar */}
                                    <div className="flex-1">
                                        {loop ? (
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: 12 }).map((_, i) => {
                                                    const slot = loop.slots?.[i];
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`h-6 flex-1 rounded ${slot?.asset_id
                                                                ? slot.status === 'REJECTED'
                                                                    ? 'bg-red-400'
                                                                    : 'bg-primary'
                                                                : 'bg-slate-300 dark:bg-slate-600'
                                                                }`}
                                                            title={`Slot ${i + 1}`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400 italic">No loop generated</span>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="w-32 text-right">
                                        {loop && (
                                            <div className="flex items-center justify-end gap-2">
                                                {rejectedSlots > 0 && (
                                                    <span className="text-xs text-red-500 font-bold">
                                                        {rejectedSlots} rejected
                                                    </span>
                                                )}
                                                <StatusBadge status={
                                                    loop.status === 'APPROVED' ? 'Active' :
                                                        loop.status === 'PENDING_APPROVAL' ? 'Warning' : 'Offline'
                                                } />
                                            </div>
                                        )}
                                    </div>

                                    {/* Action */}
                                    <div className="w-8">
                                        {loop && (
                                            <span className="material-symbols-outlined text-slate-400">
                                                chevron_right
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </GlassCard>

            {/* Empty State */}
            {!loading && loops.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">event_busy</span>
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">
                        No Schedule Available
                    </h3>
                    <p className="text-slate-500">
                        Tomorrow&apos;s broadcast schedule has not been generated yet.<br />
                        Please contact Softomedia operations.
                    </p>
                </div>
            )}

            {/* Loop Preview Modal */}
            {selectedLoop && (
                <LoopPreviewModal
                    loop={selectedLoop}
                    onClose={handleModalClose}
                    onRefresh={fetchLoops}
                />
            )}
        </div>
    );
}

export default ScheduleCalendar;
