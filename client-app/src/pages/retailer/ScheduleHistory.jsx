import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiService from '../../services/ApiService';
import { loopListFrom } from '../../services/loopList';
import { useAuth } from '../../contexts/AuthContext';

function ScheduleHistory() {
    const { user } = useAuth();
    // Task 2.3: scope to authenticated retailer — never retailers[0]
    // FIXME: replace apiService.getLoops() with apiService.getLoopsByRetailer(retailerId)
    //        when that scoped endpoint is available in the backend.
    const authedRetailerId = user?.retailerId || user?.retailer_id || user?.linked_entity_id || null;

    const [loops, setLoops] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    // Task 2.5: default to last 30 days, not 'all'
    const [dateFilter, setDateFilter] = useState('30d');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentRetailer, setCurrentRetailer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authedRetailerId]);

    const loadData = async () => {
        try {
            loading && setLoading(true);
            // Task 2.3: fetch only the authed retailer + all loops (scoped endpoint pending)
            // Task 2.6: fetch audit logs filtered to relevant event types (expanded below)
            const [retailer, allLoops, log] = await Promise.all([
                authedRetailerId
                    ? apiService.getRetailer(authedRetailerId)
                    : Promise.resolve(null),
                apiService.getLoops(),
                apiService.getAuditLogs()
            ]);

            setCurrentRetailer(retailer);
            setLoops(loopListFrom(allLoops));

            // Task 2.6: expanded event types — edits, overrides, cancellations added.
            // Backend tracking note: slot_edited, slot_overridden, loop_cancelled must
            // be emitted by ad-server when those events occur. Frontend filter is ready;
            // missing backend events will silently produce zero rows for those types.
            setAuditLog(log.filter(l =>
                l.action === 'loop_approved' ||
                l.action === 'slot_rejected' ||
                l.action === 'slot_booked' ||
                l.action === 'slot_edited' ||
                l.action === 'slot_overridden' ||
                l.action === 'loop_cancelled'
            ));
        } catch (error) {
            console.error('Failed to load schedule history:', error);
        } finally {
            setLoading(false);
        }
    };

    // Task 2.4: CSV export handler — was a stub with no onClick
    const handleExportCSV = () => {
        const rows = Object.values(filteredLoops).flatMap(group =>
            group.loops.map(loop => ({
                date: group.date,
                hour: group.hour,
                screen_id: loop.screen_id,
                status: loop.status,
                booked_slots: loop.slots?.filter(s => (s.status || '').toUpperCase() === 'BOOKED').length ?? 0,
                rejected_slots: loop.slots?.filter(s => (s.status || '').toUpperCase() === 'REJECTED').length ?? 0,
                validated_at: loop.approved_at || loop.validatedAt || ''
            }))
        );

        const headers = ['date', 'hour', 'screen_id', 'status', 'booked_slots', 'rejected_slots', 'validated_at'];
        const csv = [
            headers.join(','),
            ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule-history-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Task 2.5: sentinel-value date filtering (30d / 90d / all)
    const filteredLoops = useMemo(() => {
        let result = currentRetailer
            ? loops.filter(l => l.retailer_id === currentRetailer.id)
            : loops;

        if (dateFilter === '30d') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            result = result.filter(l => new Date(l.date) >= cutoff);
        } else if (dateFilter === '90d') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 90);
            result = result.filter(l => new Date(l.date) >= cutoff);
        }
        // dateFilter === 'all' — no date restriction

        if (statusFilter !== 'all') {
            const filterValue = statusFilter.toUpperCase();
            result = result.filter(l => (l.status || '').toUpperCase() === filterValue);
        }

        // Group by date and hour
        return result.reduce((acc, loop) => {
            const key = `${loop.date}_${loop.hour}`;
            if (!acc[key]) {
                acc[key] = {
                    date: loop.date,
                    hour: loop.hour,
                    loops: []
                };
            }
            acc[key].loops.push(loop);
            return acc;
        }, {});
    }, [loops, currentRetailer, dateFilter, statusFilter]);

    const formatHour = (hour) => {
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:00 ${suffix}`;
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusCounts = () => {
        const retailerLoops = currentRetailer
            ? loops.filter(l => l.retailer_id === currentRetailer.id)
            : loops;

        return {
            approved: retailerLoops.filter(l => (l.status || '').toUpperCase() === 'APPROVED').length,
            pending: retailerLoops.filter(l => (l.status || '').toUpperCase() === 'PENDING' || l.status === 'PENDING_APPROVAL').length,
            rejected: retailerLoops.filter(l => l.slots?.some(s => s.status === 'REJECTED')).length
        };
    };

    const statusCounts = getStatusCounts();

    if (loading) return <div className="animate-pulse space-y-4">
        <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
        </div>
    </div>;

    return (
        <div data-testid="schedule-history" className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Schedule History
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {currentRetailer ? (
                            <>
                                <span className="text-xl mr-1">{currentRetailer.logo}</span>
                                {currentRetailer.name} - Approval History
                            </>
                        ) : (
                            'View past schedule approvals and rejections'
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Task 2.5: 30d/90d/all sentinel options — individual date picker is post-MVP */}
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="30d">Last 30 days (default)</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All available dates</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="all">All Status</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard
                    className={`border-l-4 border-l-emerald-500 cursor-pointer transition-all hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 ${statusFilter === 'approved' ? 'ring-2 ring-emerald-500 shadow-lg' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                        <p className="text-sm font-medium text-slate-500">Approved Loops</p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-500">{statusCounts.approved}</p>
                </GlassCard>
                <GlassCard
                    className={`border-l-4 border-l-amber-500 cursor-pointer transition-all hover:bg-amber-50/50 dark:hover:bg-amber-900/10 ${statusFilter === 'pending' ? 'ring-2 ring-amber-500 shadow-lg' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-amber-500">schedule</span>
                        <p className="text-sm font-medium text-slate-500">Pending Review</p>
                    </div>
                    <p className="text-3xl font-bold text-amber-500">{statusCounts.pending}</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-rose-500">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-rose-500">block</span>
                        <p className="text-sm font-medium text-slate-500">Rejected Slots</p>
                    </div>
                    <p className="text-3xl font-bold text-rose-500">{statusCounts.rejected}</p>
                </GlassCard>
            </div>

            {/* History List */}
            <GlassCard>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Schedule Log</h3>
                    {/* Task 2.4: wired CSV export — was a no-op stub */}
                    <button
                        onClick={handleExportCSV}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Export CSV
                    </button>
                </div>

                <div className="space-y-4">
                    {Object.keys(filteredLoops).length === 0 ? (
                        <p className="text-center text-slate-400 py-8">No schedule history found</p>
                    ) : (
                        Object.values(filteredLoops)
                            .sort((a, b) => `${b.date}_${b.hour}`.localeCompare(`${a.date}_${a.hour}`))
                            .slice(0, 20)
                            .map((group, idx) => (
                                <div
                                    key={idx}
                                    data-testid="schedule-history-row"
                                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary">calendar_today</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold">{formatDate(group.date)}</p>
                                                <p className="text-xs text-slate-500">{formatHour(group.hour)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-slate-500">
                                                {group.loops.length} screen{group.loops.length > 1 ? 's' : ''}
                                            </span>
                                            <StatusBadge status={
                                                group.loops.every(l => (l.status || '').toUpperCase() === 'APPROVED')
                                                    ? 'Approved'
                                                    : group.loops.some(l => (l.status || '').toUpperCase() === 'APPROVED')
                                                        ? 'Partial'
                                                        : 'Pending'
                                            } />
                                        </div>
                                    </div>

                                    {/* Slot summary */}
                                    <div className="flex flex-wrap gap-1">
                                        {group.loops.slice(0, 5).map(loop => {
                                            const bookedSlots = loop.slots?.filter(s => (s.status || '').toUpperCase() === 'BOOKED').length || 0;
                                            const rejectedSlots = loop.slots?.filter(s => (s.status || '').toUpperCase() === 'REJECTED').length || 0;
                                            return (
                                                <span
                                                    key={loop.id}
                                                    className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                >
                                                    {loop.screen_id?.split('_').slice(-2).join('-')}: {bookedSlots}/12 booked
                                                    {rejectedSlots > 0 && (
                                                        <span className="text-rose-500 ml-1">({rejectedSlots} rejected)</span>
                                                    )}
                                                </span>
                                            );
                                        })}
                                        {group.loops.length > 5 && (
                                            <span className="text-xs px-2 py-1 text-slate-400">
                                                +{group.loops.length - 5} more
                                            </span>
                                        )}
                                    </div>

                                    {/* Validation info */}
                                    {(group.loops[0].approved_at || group.loops[0].validatedAt) && (
                                        <p className="text-xs text-slate-400 mt-2">
                                            Validated: {new Date(group.loops[0].approved_at || group.loops[0].validatedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ))
                    )}
                </div>
            </GlassCard>

            {/* Recent Activity */}
            <GlassCard>
                <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
                <div className="space-y-3">
                    {auditLog.slice(0, 10).map(entry => (
                        <div
                            key={entry.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <div className={`size-8 rounded-lg flex items-center justify-center ${entry.action === 'loop_approved'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                                    : entry.action === 'slot_rejected' || entry.action === 'loop_cancelled'
                                        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                                        : entry.action === 'slot_overridden' || entry.action === 'slot_edited'
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                }`}>
                                <span className="material-symbols-outlined text-lg">
                                    {entry.action === 'loop_approved' ? 'check'
                                        : entry.action === 'slot_rejected' ? 'block'
                                            : entry.action === 'loop_cancelled' ? 'cancel'
                                                : entry.action === 'slot_overridden' ? 'edit_off'
                                                    : entry.action === 'slot_edited' ? 'edit'
                                                        : 'add_circle'}
                                </span>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {entry.action === 'loop_approved' && 'Loop approved'}
                                    {entry.action === 'slot_rejected' && 'Slot rejected'}
                                    {entry.action === 'slot_booked' && 'Slot booked'}
                                    {entry.action === 'slot_edited' && 'Slot edited'}
                                    {entry.action === 'slot_overridden' && 'Slot overridden'}
                                    {entry.action === 'loop_cancelled' && 'Loop cancelled'}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {entry.entity_id || entry.entityId}
                                    {entry.details?.reason && ` - ${entry.details.reason}`}
                                    {entry.reason && ` - ${entry.reason}`}
                                </p>
                            </div>
                            <span className="text-xs text-slate-400">
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                    {auditLog.length === 0 && (
                        <p className="text-center text-slate-400 py-4">No recent activity</p>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}

export default ScheduleHistory;
