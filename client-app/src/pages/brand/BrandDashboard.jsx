import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import useCampaignStore from '../../stores/useCampaignStore';
import CampaignUploadDrawer from '../../components/CampaignUploadDrawer';
import ScheduleTimeline from '../../components/ScheduleTimeline';
import { Megaphone, CalendarDays, Plus } from 'lucide-react';

// ─── Stat atom ─────────────────────────────────────────────────────────────────────
function Stat({ label, value, sub }) {
    return (
        <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-alpha)',
            borderRadius: '0.625rem',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.125rem 1.375rem',
        }}>
            <p style={{
                fontSize: '0.8125rem',
                fontWeight: '500',
                color: 'var(--color-text-muted)',
                marginBottom: '0.375rem',
            }}>
                {label}
            </p>
            <p style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                color: 'var(--color-text)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
                marginBottom: sub ? '0.25rem' : 0,
            }}>
                {value}
            </p>
            {sub && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', margin: 0 }}>
                    {sub}
                </p>
            )}
        </div>
    );
}

// ─── EmptyState atom ───────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, heading, body, ctaLabel, onCta }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 2rem',
            gap: '0.75rem',
            textAlign: 'center',
        }}>
            <div style={{
                width: '48px', height: '48px',
                borderRadius: '0.625rem',
                backgroundColor: 'var(--color-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '0.25rem',
            }}>
                <Icon size={22} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            </div>
            <p style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'var(--color-text)', margin: 0 }}>
                {heading}
            </p>
            {body && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '320px' }}>
                    {body}
                </p>
            )}
            {ctaLabel && onCta && (
                <button
                    onClick={onCta}
                    style={{
                        marginTop: '0.5rem',
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        height: '34px', padding: '0 0.875rem',
                        backgroundColor: 'var(--color-primary)', color: '#fff',
                        border: 'none', borderRadius: '0.4rem',
                        fontSize: '0.8125rem', fontWeight: '600', cursor: 'pointer',
                        transition: 'background-color 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                >
                    <Plus size={14} aria-hidden="true" />
                    {ctaLabel}
                </button>
            )}
        </div>
    );
}

// ─── Status badge ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
    live:      { dot: 'var(--color-success)',        bg: 'var(--color-success-light)',  text: 'var(--color-success-text)',  label: 'Live' },
    active:    { dot: 'var(--color-success)',        bg: 'var(--color-success-light)',  text: 'var(--color-success-text)',  label: 'Active' },
    pending:   { dot: 'var(--color-warning)',        bg: 'var(--color-warning-light)',  text: 'var(--color-warning-text)',  label: 'Pending' },
    scheduled: { dot: 'var(--color-warning)',        bg: 'var(--color-warning-light)',  text: 'var(--color-warning-text)',  label: 'Scheduled' },
    completed: { dot: 'var(--color-text-faint)',     bg: 'var(--color-surface-2)',      text: 'var(--color-text-muted)',    label: 'Completed' },
    paused:    { dot: 'var(--color-text-faint)',     bg: 'var(--color-surface-2)',      text: 'var(--color-text-muted)',    label: 'Paused' },
    rejected:  { dot: 'var(--color-error)',          bg: 'var(--color-error-light)',    text: 'var(--color-error-text)',    label: 'Rejected' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CFG[status?.toLowerCase()] || {
        dot: 'var(--color-text-faint)', bg: 'var(--color-surface-2)',
        text: 'var(--color-text-muted)', label: status || 'Unknown',
    };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '2px 9px', borderRadius: '9999px',
            fontSize: '0.75rem', fontWeight: '600',
            backgroundColor: cfg.bg, color: cfg.text,
        }}>
            <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: cfg.dot, flexShrink: 0,
            }} />
            {cfg.label}
        </span>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────────────
function BrandDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { setEditMode, setCampaignData } = useCampaignStore();
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [error, setError] = useState(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [hoveredRow, setHoveredRow] = useState(null);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const data = await dashboardAPI.getBrandDashboard(user?.linked_entity_id);
            setDashboardData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.linked_entity_id) fetchDashboardData();
    }, [user]);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Loading…
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error-text)' }}>
                <p style={{ fontWeight: '600' }}>Error loading dashboard</p>
                <p style={{ fontSize: '0.875rem' }}>{error}</p>
            </div>
        );
    }

    const { summary, campaigns = [], credits = 0 } = dashboardData || {};

    const thStyle = {
        padding: '0.625rem 0.875rem',
        textAlign: 'left',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'var(--color-text-muted)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
    };

    const tdStyle = {
        padding: '0.625rem 0.875rem',
        fontSize: '0.875rem',
        color: 'var(--color-text)',
        verticalAlign: 'middle',
    };

    return (
        <div style={{ minHeight: '100%' }}>

            {/* ── Header ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '1.5rem',
            }}>
                <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>
                        Brand Dashboard
                    </h2>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Campaign performance and analytics
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button
                        onClick={() => setShowTimeline(!showTimeline)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            height: '34px', padding: '0 0.875rem',
                            backgroundColor: showTimeline ? 'var(--color-primary-light)' : 'var(--color-surface)',
                            color: showTimeline ? 'var(--color-primary-text)' : 'var(--color-text)',
                            border: '1px solid ' + (showTimeline ? 'rgba(37,99,235,0.3)' : 'var(--color-border)'),
                            borderRadius: '0.4rem',
                            fontSize: '0.8125rem', fontWeight: '500', cursor: 'pointer',
                            transition: 'background-color 150ms',
                        }}
                    >
                        <CalendarDays size={14} aria-hidden="true" />
                        {showTimeline ? 'Hide Timeline' : 'Schedule Timeline'}
                    </button>
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            height: '34px', padding: '0 0.875rem',
                            backgroundColor: 'var(--color-primary)', color: '#fff',
                            border: 'none', borderRadius: '0.4rem',
                            fontSize: '0.8125rem', fontWeight: '600', cursor: 'pointer',
                            transition: 'background-color 150ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                    >
                        <Plus size={14} aria-hidden="true" />
                        Create Campaign
                    </button>
                </div>
            </div>

            {/* ── Stat strip ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.875rem',
                marginBottom: '1.5rem',
            }}>
                <Stat label="Active Campaigns"  value={summary?.total_campaigns ?? 0} />
                <Stat label="Total Impressions" value={(summary?.total_impressions ?? 0).toLocaleString()} />
                <Stat label="Ad Credits"        value={(credits ?? 0).toLocaleString()} />
                <Stat label="Screens Reached"   value={summary?.screens_reached ?? 0} />
            </div>

            {/* ── Schedule Timeline ── */}
            {showTimeline && campaigns.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <ScheduleTimeline campaigns={campaigns} />
                </div>
            )}

            {/* ── Campaigns table ── */}
            <div style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border-alpha)',
                borderRadius: '0.625rem',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.875rem 1.125rem',
                    borderBottom: campaigns.length > 0 ? '1px solid var(--color-border)' : 'none',
                }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text)' }}>
                        Your Campaigns
                    </span>
                    {campaigns.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {campaigns.length === 0 ? (
                    <EmptyState
                        icon={Megaphone}
                        heading="No campaigns yet"
                        body="Create your first campaign to start reaching customers on screens across the network."
                        ctaLabel="Create your first campaign"
                        onCta={() => setIsUploadOpen(true)}
                    />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Campaign</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Impressions</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Duration</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((campaign, idx) => (
                                    <tr
                                        key={campaign.id ?? idx}
                                        onMouseEnter={() => setHoveredRow(idx)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                        style={{
                                            borderBottom: idx < campaigns.length - 1
                                                ? '1px solid var(--color-border)'
                                                : 'none',
                                            backgroundColor: hoveredRow === idx
                                                ? 'var(--color-surface-2)'
                                                : 'transparent',
                                            transition: 'background-color 100ms',
                                        }}
                                    >
                                        <td style={{ ...tdStyle, fontWeight: '500' }}>
                                            {campaign.title}
                                        </td>
                                        <td style={tdStyle}>
                                            <StatusBadge status={campaign.status} />
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                            {(campaign.impressions || 0).toLocaleString()}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                            {campaign.duration}s
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <button
                                                onClick={() => {
                                                    setEditMode(true);
                                                    setCampaignData(campaign);
                                                    navigate(`/brand/campaign/${campaign.id}/edit`);
                                                }}
                                                style={{
                                                    height: '28px', padding: '0 0.625rem',
                                                    fontSize: '0.75rem', fontWeight: '500',
                                                    backgroundColor: 'var(--color-surface-2)',
                                                    color: 'var(--color-text)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '0.3rem',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 120ms',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-border)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Upload drawer ── */}
            <CampaignUploadDrawer
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onSuccess={fetchDashboardData}
            />
        </div>
    );
}

export default BrandDashboard;
