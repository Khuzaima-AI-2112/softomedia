import { useState, useEffect, useMemo } from 'react';
import { Download, CheckCircle2, Clock, XCircle } from 'lucide-react';
import apiService from '../../services/ApiService';
import '../../design-tokens.css';

function ScheduleHistory() {
    const [loops, setLoops]                       = useState([]);
    const [auditLog, setAuditLog]                 = useState([]);
    const [dateFilter, setDateFilter]             = useState('all');
    const [statusFilter, setStatusFilter]         = useState('all');
    const [currentRetailer, setCurrentRetailer]   = useState(null);
    const [loading, setLoading]                   = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [retailers, allLoops, log] = await Promise.all([
                apiService.getRetailers(),
                apiService.getLoops(),
                apiService.getAuditLogs(),
            ]);
            if (retailers.length > 0) setCurrentRetailer(retailers[0]);
            setLoops(allLoops);
            setAuditLog(log.filter(l => ['loop_approved', 'slot_rejected', 'slot_booked'].includes(l.action)));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const availableDates = useMemo(() => [
        ...new Set(loops.map(l => l.date))
    ].sort().reverse(), [loops]);

    const filteredLoops = useMemo(() => {
        let result = currentRetailer ? loops.filter(l => l.retailer_id === currentRetailer.id) : loops;
        if (dateFilter !== 'all') result = result.filter(l => l.date === dateFilter);
        if (statusFilter !== 'all') result = result.filter(l => (l.status || '').toUpperCase() === statusFilter.toUpperCase());
        return result.reduce((acc, loop) => {
            const key = `${loop.date}_${loop.hour}`;
            if (!acc[key]) acc[key] = { date: loop.date, hour: loop.hour, loops: [] };
            acc[key].loops.push(loop);
            return acc;
        }, {});
    }, [loops, currentRetailer, dateFilter, statusFilter]);

    const formatHour = (hour) => {
        const s = hour >= 12 ? 'PM' : 'AM';
        const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${h}:00 ${s}`;
    };
    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const getStatusCounts = () => {
        const rl = currentRetailer ? loops.filter(l => l.retailer_id === currentRetailer.id) : loops;
        return {
            approved: rl.filter(l => (l.status || '').toUpperCase() === 'APPROVED').length,
            pending:  rl.filter(l => (l.status || '').toUpperCase() === 'PENDING' || l.status === 'PENDING_APPROVAL').length,
            rejected: rl.filter(l => l.slots?.some(s => s.status === 'REJECTED')).length,
        };
    };
    const counts = getStatusCounts();

    const handleExportCSV = () => {
        const rows = [['Date', 'Hour', 'Screens', 'Status']];
        Object.values(filteredLoops).forEach(g => {
            rows.push([g.date, formatHour(g.hour), g.loops.length,
                g.loops.every(l => (l.status || '').toUpperCase() === 'APPROVED') ? 'Approved' : 'Pending']);
        });
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'schedule-history.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5)',
    };
    const selectStyle = {
        padding: '0.5rem 0.75rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-body)',
        outline: 'none', cursor: 'pointer',
    };

    const STAT_CARDS = [
        { label: 'Approved Loops', value: counts.approved, icon: <CheckCircle2 size={16} />, color: 'var(--color-success)', bg: 'var(--color-success-light)', filter: 'approved' },
        { label: 'Pending Review', value: counts.pending,  icon: <Clock size={16} />,        color: '#d97706',              bg: 'rgba(217,119,6,0.1)',      filter: 'pending' },
        { label: 'Rejected Slots', value: counts.rejected, icon: <XCircle size={16} />,      color: 'var(--color-error)',   bg: 'var(--color-error-light)', filter: null },
    ];

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-hover)' }} />)}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Schedule History</h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                        {currentRetailer ? `${currentRetailer.name} — Approval History` : 'View past schedule approvals and rejections'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={selectStyle}>
                        <option value="all">All Dates</option>
                        {availableDates.map(d => <option key={d} value={d}>{formatDate(d)}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                        <option value="all">All Status</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                {STAT_CARDS.map(sc => (
                    <div
                        key={sc.label}
                        style={{
                            ...card,
                            cursor: sc.filter ? 'pointer' : 'default',
                            outline: sc.filter && statusFilter === sc.filter ? `2px solid ${sc.color}` : '2px solid transparent',
                            transition: 'all var(--transition-fast)',
                        }}
                        onClick={() => sc.filter && setStatusFilter(statusFilter === sc.filter ? 'all' : sc.filter)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
                            <span style={{
                                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                backgroundColor: sc.bg, color: sc.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>{sc.icon}</span>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', margin: 0 }}>{sc.label}</p>
                        </div>
                        <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: sc.color, margin: 0, lineHeight: 1 }}>{sc.value}</p>
                    </div>
                ))}
            </div>

            {/* Schedule log */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Schedule Log</p>
                    <button
                        onClick={handleExportCSV}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                            color: 'var(--color-text-secondary)', cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                    >
                        <Download size={13} /> Export CSV
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {Object.keys(filteredLoops).length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-8) 0', margin: 0 }}>No schedule history found</p>
                    ) : (
                        Object.values(filteredLoops)
                            .sort((a, b) => `${b.date}_${b.hour}`.localeCompare(`${a.date}_${a.hour}`))
                            .slice(0, 20)
                            .map((group, idx) => {
                                const allApproved = group.loops.every(l => (l.status || '').toUpperCase() === 'APPROVED');
                                const badgeColor = allApproved ? 'var(--color-success)' : '#d97706';
                                const badgeBg    = allApproved ? 'var(--color-success-light)' : 'rgba(217,119,6,0.1)';
                                const badgeLabel = allApproved ? 'Approved' : group.loops.some(l => (l.status || '').toUpperCase() === 'APPROVED') ? 'Partial' : 'Pending';
                                return (
                                    <div key={idx} style={{
                                        padding: 'var(--space-4)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-hover)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                                                    backgroundColor: 'rgba(99,102,241,0.1)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--color-primary)', flexShrink: 0,
                                                }}><CheckCircle2 size={16} /></div>
                                                <div>
                                                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>{formatDate(group.date)}</p>
                                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{formatHour(group.hour)}</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{group.loops.length} screen{group.loops.length > 1 ? 's' : ''}</span>
                                                <span style={{
                                                    fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                    backgroundColor: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}40`,
                                                }}>{badgeLabel}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                            {group.loops.slice(0, 5).map(loop => {
                                                const booked   = loop.slots?.filter(s => (s.status || '').toUpperCase() === 'BOOKED').length || 0;
                                                const rejected = loop.slots?.filter(s => (s.status || '').toUpperCase() === 'REJECTED').length || 0;
                                                return (
                                                    <span key={loop.id} style={{
                                                        fontSize: 'var(--text-xs)', padding: '2px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        backgroundColor: 'var(--color-bg-card)',
                                                        border: '1px solid var(--color-border)',
                                                        color: 'var(--color-text-secondary)',
                                                    }}>
                                                        {loop.screen_id?.split('_').slice(-2).join('-')}: {booked}/12
                                                        {rejected > 0 && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>({rejected} rejected)</span>}
                                                    </span>
                                                );
                                            })}
                                            {group.loops.length > 5 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', padding: '2px 6px' }}>+{group.loops.length - 5} more</span>}
                                        </div>
                                        {(group.loops[0].approved_at || group.loops[0].validatedAt) && (
                                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                                                Validated: {new Date(group.loops[0].approved_at || group.loops[0].validatedAt).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                );
                            })
                    )}
                </div>
            </div>

            {/* Recent Activity */}
            <div style={card}>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4)' }}>Recent Activity</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {auditLog.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-4) 0', margin: 0 }}>No recent activity</p>
                    ) : auditLog.slice(0, 10).map(entry => {
                        const isApproved = entry.action === 'loop_approved';
                        const isRejected = entry.action === 'slot_rejected';
                        const iconColor  = isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : 'var(--color-primary)';
                        const iconBg     = isApproved ? 'var(--color-success-light)' : isRejected ? 'var(--color-error-light)' : 'rgba(99,102,241,0.1)';
                        return (
                            <div key={entry.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                transition: 'background-color var(--transition-fast)',
                            }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <span style={{
                                    width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                                    backgroundColor: iconBg, color: iconColor,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    {isApproved ? <CheckCircle2 size={14} /> : isRejected ? <XCircle size={14} /> : <Clock size={14} />}
                                </span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                                        {isApproved ? 'Loop approved' : isRejected ? 'Slot rejected' : 'Slot booked'}
                                    </p>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                                        {entry.entity_id || entry.entityId}
                                        {(entry.details?.reason || entry.reason) && ` — ${entry.details?.reason || entry.reason}`}
                                    </p>
                                </div>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default ScheduleHistory;
