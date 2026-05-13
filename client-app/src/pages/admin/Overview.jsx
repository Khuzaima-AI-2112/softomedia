import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, Users, Store, Megaphone,
    Play, Clock, Map, ArrowRight,
    TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import '../../design-tokens.css';

/**
 * Admin Overview — Platform Governance (Super Admin)
 * Spec: no icon grid, no colored left-border cards.
 * Actions: left-aligned 2-col action strip.
 * KPIs: neutral surface, large number, trend chip.
 */

// ─── Action strip data ─────────────────────────────────────────────────────────────
const ACTIONS = [
    { icon: DollarSign, label: 'CPM Pricing',   desc: 'Set ad slot rates & floor prices',          route: '/dashboard/admin/pricing' },
    { icon: Users,      label: 'Users',         desc: 'Manage platform accounts & roles',           route: '/dashboard/admin/users' },
    { icon: Store,      label: 'Retailers',     desc: 'Onboard and configure retail partners',      route: '/dashboard/admin/retailers' },
    { icon: Megaphone,  label: 'Advertisers',   desc: 'Review advertiser accounts & budgets',       route: '/dashboard/admin/advertisers' },
    { icon: Play,       label: 'Demo Player',   desc: 'Preview live loop playback in-browser',      route: '/player/demo' },
    { icon: Clock,      label: 'Store Hours',   desc: 'Configure business hours per location',      route: '/dashboard/admin/hours' },
    { icon: Map,        label: 'Network Map',   desc: 'Visualise screen coverage across locations', route: '/dashboard/admin/map' },
];

// ─── Trend chip ──────────────────────────────────────────────────────────────────────
function TrendChip({ direction = 'flat', label }) {
    const cfg = {
        up:   { Icon: TrendingUp,   bg: 'var(--color-success-light)', color: '#03543f' },
        down: { Icon: TrendingDown, bg: 'var(--color-error-light)',   color: '#9b1c1c' },
        flat: { Icon: Minus,        bg: 'var(--color-bg-hover)',      color: 'var(--color-text-secondary)' },
    }[direction];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '2px 7px', borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
            backgroundColor: cfg.bg, color: cfg.color,
        }}>
            <cfg.Icon size={10} aria-hidden="true" />
            {label}
        </span>
    );
}

// ─── KPI card ────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, trendLabel }) {
    return (
        <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.125rem 1.375rem',
        }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                {label}
            </p>
            <p style={{
                fontSize: '1.75rem',
                fontWeight: 'var(--font-bold)',
                color: 'var(--color-text-primary)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
                marginBottom: '0.5rem',
            }}>
                {value}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {trend && trendLabel && <TrendChip direction={trend} label={trendLabel} />}
                {sub && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{sub}</span>
                )}
            </div>
        </div>
    );
}

// ─── Action row ───────────────────────────────────────────────────────────────────
function ActionRow({ icon: Icon, label, desc, onClick, last }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: last ? 'none' : '1px solid var(--color-border-light)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                backgroundColor: 'var(--color-bg-hover)',
                color: 'var(--color-primary)',
            }}>
                <Icon size={16} aria-hidden="true" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                    {label}
                </span>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {desc}
                </span>
            </span>
            <ArrowRight size={14} aria-hidden="true" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        </button>
    );
}

// ─── Shared card style ────────────────────────────────────────────────────────────────
const cardStyle = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
};

const cardHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.875rem 1.125rem',
    borderBottom: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-card)',
};

const listRowStyle = (last) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.625rem 1.125rem',
    borderBottom: last ? 'none' : '1px solid var(--color-border-light)',
});

// ─── Main component ──────────────────────────────────────────────────────────────────
function DashboardOverview() {
    const navigate = useNavigate();

    const [retailers, setRetailers]           = React.useState([]);
    const [advertisers, setAdvertisers]       = React.useState([]);
    const [screens, setScreens]               = React.useState([]);
    const [platformUsers, setPlatformUsers]   = React.useState([]);
    const [loading, setLoading]               = React.useState(true);

    React.useEffect(() => {
        const API_URL = window.__API_URL__ || '';
        const headers = { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` };
        Promise.allSettled([
            fetch(`${API_URL}/api/retailers`,   { headers }).then(r => r.json()),
            fetch(`${API_URL}/api/advertisers`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/api/screens`,     { headers }).then(r => r.json()),
            fetch(`${API_URL}/api/users`,       { headers }).then(r => r.json()),
        ]).then(([rRes, aRes, sRes, uRes]) => {
            if (rRes.status === 'fulfilled') setRetailers(rRes.value?.retailers     || rRes.value?.data || []);
            if (aRes.status === 'fulfilled') setAdvertisers(aRes.value?.advertisers || aRes.value?.data || []);
            if (sRes.status === 'fulfilled') setScreens(sRes.value?.screens         || sRes.value?.data || []);
            if (uRes.status === 'fulfilled') setPlatformUsers(uRes.value?.users     || uRes.value?.data || []);
            setLoading(false);
        });
    }, []);

    const screensOnline = screens.filter(s => s.status === 'online' || s.status === 'active').length;
    const val = (n) => loading ? '—' : n;

    const col1 = ACTIONS.filter((_, i) => i % 2 === 0);
    const col2 = ACTIONS.filter((_, i) => i % 2 === 1);

    return (
        <div style={{ minHeight: '100%' }}>

            {/* ── Page header ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '1.5rem',
            }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                        Platform Governance
                    </h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Softomedia Super Admin Control Center
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button
                        onClick={() => navigate('/dashboard/admin/retailers')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            height: '34px', padding: '0 0.875rem',
                            backgroundColor: 'var(--color-primary)', color: '#fff',
                            border: 'none', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', cursor: 'pointer',
                            transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                    >
                        + New Retailer
                    </button>
                    <button
                        onClick={() => navigate('/dashboard/admin/map')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            height: '34px', padding: '0 0.875rem',
                            backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
                            cursor: 'pointer', transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                    >
                        Network Map
                    </button>
                </div>
            </div>

            {/* ── KPI strip ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.875rem',
                marginBottom: '1.5rem',
            }}>
                <KpiCard label="Retailers"      value={val(retailers.length)}      trend="flat" trendLabel="No change" />
                <KpiCard label="Advertisers"    value={val(advertisers.length)}    trend="flat" trendLabel="No change" />
                <KpiCard
                    label="Screens Online"
                    value={val(screensOnline)}
                    sub={!loading ? `of ${screens.length} total` : undefined}
                    trend={screensOnline > 0 ? 'up' : 'flat'}
                    trendLabel={screensOnline > 0 ? `${screensOnline} live` : 'None live'}
                />
                <KpiCard label="Platform Users" value={val(platformUsers.length)} trend="flat" trendLabel="No change" />
            </div>

            {/* ── Action strip + partner lists ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                alignItems: 'start',
            }}>

                {/* Action strip — col 1 */}
                <div style={cardStyle}>
                    <div style={cardHeaderStyle}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>Quick Actions</span>
                    </div>
                    {col1.map((a, i) => (
                        <ActionRow
                            key={a.label}
                            icon={a.icon}
                            label={a.label}
                            desc={a.desc}
                            onClick={() => navigate(a.route)}
                            last={i === col1.length - 1}
                        />
                    ))}
                </div>

                {/* Action strip — col 2 */}
                <div style={cardStyle}>
                    <div style={{ ...cardHeaderStyle, visibility: 'hidden' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>&nbsp;</span>
                    </div>
                    {col2.map((a, i) => (
                        <ActionRow
                            key={a.label}
                            icon={a.icon}
                            label={a.label}
                            desc={a.desc}
                            onClick={() => navigate(a.route)}
                            last={i === col2.length - 1}
                        />
                    ))}
                </div>

                {/* Partner lists — col 3, surface-2 (bg-card) to separate from page bg */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Retail Partners */}
                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>Retail Partners</span>
                            <button
                                onClick={() => navigate('/dashboard/admin/retailers')}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
                            >
                                View all →
                            </button>
                        </div>
                        {loading ? (
                            <p style={{ padding: '0.75rem 1.125rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Loading…</p>
                        ) : retailers.length === 0 ? (
                            <p style={{ padding: '0.75rem 1.125rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>No retailers yet.</p>
                        ) : (
                            retailers.slice(0, 4).map((r, i) => (
                                <div key={r.id || r.retailer_id} style={listRowStyle(i === Math.min(retailers.length, 4) - 1)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                                        <div style={{
                                            width: '30px', height: '30px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                                            backgroundColor: 'var(--color-bg-hover)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {r.logo_url
                                                ? <img src={r.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                                                : <Store size={14} style={{ color: 'var(--color-text-secondary)' }} />}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.name || r.business_name || 'Unnamed'}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                                                {r.location_count ?? 0} location{r.location_count !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="badge-active" style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', flexShrink: 0,
                                    }}>
                                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
                                        Active
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Key Advertisers */}
                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>Key Advertisers</span>
                            <button
                                onClick={() => navigate('/dashboard/admin/advertisers')}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
                            >
                                View all →
                            </button>
                        </div>
                        {loading ? (
                            <p style={{ padding: '0.75rem 1.125rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Loading…</p>
                        ) : advertisers.length === 0 ? (
                            <p style={{ padding: '0.75rem 1.125rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>No advertisers yet.</p>
                        ) : (
                            advertisers.slice(0, 4).map((a, i) => (
                                <div key={a.id || a.advertiser_id} style={listRowStyle(i === Math.min(advertisers.length, 4) - 1)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                                        <div style={{
                                            width: '30px', height: '30px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                                            backgroundColor: 'var(--color-bg-hover)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {a.logo_url
                                                ? <img src={a.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                                                : <Megaphone size={14} style={{ color: 'var(--color-text-secondary)' }} />}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {a.name || a.company_name || 'Unnamed'}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                                                {a.active_campaigns ?? 0} active campaign{a.active_campaigns !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                            ${(a.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>budget</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default DashboardOverview;
