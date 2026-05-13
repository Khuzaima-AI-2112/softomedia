/**
 * Schedule Calendar Page
 * Retailer interface for previewing and approving tomorrow's broadcast schedule
 */

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
import LoopPreviewModal from '../../components/LoopPreviewModal';
import { API_URL } from '../../config';
import '../../design-tokens.css';

const BUSINESS_HOURS = { START: 8, END: 22 };

const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) hours.push(h);
    return hours;
};

const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h}:00 ${period}`;
};

function SkeletonRow() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.125rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden', position: 'relative',
            backgroundColor: 'var(--color-bg-hover)',
        }}>
            <style>{`
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .shimmer-bar::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
                    animation: shimmer 1.4s infinite;
                }
            `}</style>
            <div className="shimmer-bar" style={{ width: 64, height: 20, borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-border)', position: 'relative' }} />
            <div className="shimmer-bar" style={{ flex: 1, height: 24, borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-border)', position: 'relative' }} />
            <div className="shimmer-bar" style={{ width: 72, height: 20, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-border)', position: 'relative' }} />
        </div>
    );
}

function ScheduleCalendar() {
    const [targetDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    const [loops, setLoops]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [selectedLoop, setSelectedLoop] = useState(null);
    const [approving, setApproving]   = useState(false);

    const businessHours = getBusinessHours();

    useEffect(() => { fetchLoops(); }, [targetDate]);

    const fetchLoops = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/loops?date=${targetDate}`);
            if (res.ok) { const data = await res.json(); setLoops(data.loops || []); }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const getLoopForHour = (hour) => loops.find(l => l.hour === hour) || null;

    const handleApproveAll = async () => {
        setApproving(true);
        try {
            const pending = loops.filter(l => l.status === 'PENDING_APPROVAL');
            for (const loop of pending) {
                await fetch(`${API_URL}/api/loops/${loop.id}/approve`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: 'retailer_demo' }),
                });
            }
            await fetchLoops();
        } catch (e) { console.error(e); }
        finally { setApproving(false); }
    };

    const pendingCount  = loops.filter(l => l.status === 'PENDING_APPROVAL').length;
    const approvedCount = loops.filter(l => l.status === 'APPROVED').length;
    const rejectedCount = loops.filter(l => l.status === 'REJECTED').length;

    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5)',
    };

    const KPI_CARDS = [
        { label: 'Total Hours',     value: businessHours.length, sub: '8AM – 10PM',                   icon: <Calendar size={16} />,      dotColor: 'var(--color-primary)', dotBg: 'rgba(99,102,241,0.12)', valueColor: 'var(--color-text-primary)' },
        { label: 'Pending Review',  value: pendingCount,         sub: 'Requires your approval',         icon: <Clock size={16} />,         dotColor: '#d97706',             dotBg: 'rgba(217,119,6,0.12)',  valueColor: '#d97706' },
        { label: 'Approved',        value: approvedCount,        sub: 'Ready to broadcast',             icon: <CheckCircle2 size={16} />,  dotColor: 'var(--color-success)', dotBg: 'var(--color-success-light)', valueColor: 'var(--color-success)' },
        { label: 'Needs Attention', value: rejectedCount,        sub: 'Rejected ads need replacement',  icon: <AlertCircle size={16} />,   dotColor: 'var(--color-error)',   dotBg: 'var(--color-error-light)',   valueColor: 'var(--color-error)' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Tomorrow’s Broadcast Schedule</h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                        Review and approve the schedule for{' '}
                        <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--color-primary)' }}>
                            {new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                    </p>
                </div>
                {pendingCount > 0 && (
                    <button
                        onClick={handleApproveAll}
                        disabled={approving}
                        data-testid="approve-all-btn"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.625rem 1.125rem',
                            backgroundColor: 'var(--color-success)', color: '#fff',
                            border: 'none', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                            cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.6 : 1,
                            boxShadow: 'var(--shadow-sm)', transition: 'all var(--transition-fast)',
                        }}
                    >
                        <CheckCircle2 size={16} />
                        {approving ? 'Approving…' : `Approve All (${pendingCount})`}
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
                {KPI_CARDS.map(kpi => (
                    <div key={kpi.label} style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
                            <span style={{
                                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                backgroundColor: kpi.dotBg, color: kpi.dotColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>{kpi.icon}</span>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.2 }}>{kpi.label}</p>
                        </div>
                        <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: kpi.valueColor, margin: 0, lineHeight: 1 }}>{kpi.value}</p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* Timeline */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Hourly Schedule Timeline</p>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        {[['var(--color-success)', 'Approved'], ['#d97706', 'Pending'], ['var(--color-error)', 'Rejected']].map(([c, l]) => (
                            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c, flexShrink: 0 }} />{l}
                            </span>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} data-testid="schedule-timeline">
                    {loading
                        ? businessHours.map(h => <SkeletonRow key={h} />)
                        : businessHours.map(hour => {
                            const loop = getLoopForHour(hour);
                            const rejectedSlots = loop?.slots?.filter(s => s.status === 'REJECTED').length || 0;
                            const statusColor =
                                !loop ? null
                                : loop.status === 'APPROVED'         ? 'var(--color-success)'
                                : loop.status === 'PENDING_APPROVAL' ? '#d97706'
                                : 'var(--color-error)';

                            return (
                                <button
                                    key={hour}
                                    onClick={() => loop && setSelectedLoop(loop)}
                                    disabled={!loop}
                                    data-testid={`schedule-hour-${hour}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                        padding: '0.875rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: loop ? `1.5px solid ${statusColor}33` : '1.5px dashed var(--color-border)',
                                        backgroundColor: loop ? `${statusColor}0d` : 'var(--color-bg-hover)',
                                        opacity: !loop ? 0.5 : 1,
                                        cursor: !loop ? 'not-allowed' : 'pointer',
                                        transition: 'all var(--transition-fast)',
                                        width: '100%', textAlign: 'left',
                                    }}
                                >
                                    <span style={{ width: 72, fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', flexShrink: 0 }}>
                                        {formatHour(hour)}
                                    </span>
                                    <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                                        {loop
                                            ? Array.from({ length: 12 }).map((_, i) => {
                                                const slot = loop.slots?.[i];
                                                const slotColor = slot?.asset_id
                                                    ? slot.status === 'REJECTED' ? 'var(--color-error)' : 'var(--color-primary)'
                                                    : 'var(--color-border)';
                                                return <div key={i} style={{ height: 22, flex: 1, borderRadius: 3, backgroundColor: slotColor }} title={`Slot ${i + 1}`} />;
                                            })
                                            : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No loop generated</span>
                                        }
                                    </div>
                                    {loop && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                                            {rejectedSlots > 0 && (
                                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-error)' }}>{rejectedSlots} rejected</span>
                                            )}
                                            <span style={{
                                                fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                backgroundColor: `${statusColor}1a`, color: statusColor,
                                                border: `1px solid ${statusColor}40`,
                                            }}>
                                                {loop.status === 'APPROVED' ? 'Approved' : loop.status === 'PENDING_APPROVAL' ? 'Pending' : 'Rejected'}
                                            </span>
                                            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 16 }}>›</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    }
                </div>
            </div>

            {/* Empty state */}
            {!loading && loops.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-6)', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-secondary)', margin: 0 }}>No Schedule Available</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>Tomorrow’s broadcast schedule has not been generated yet. Please contact Softomedia operations.</p>
                </div>
            )}

            {selectedLoop && (
                <LoopPreviewModal loop={selectedLoop} onClose={() => { setSelectedLoop(null); fetchLoops(); }} onRefresh={fetchLoops} />
            )}
        </div>
    );
}

export default ScheduleCalendar;
