import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../design-tokens.css';

/**
 * DashboardOverview — Platform Governance (Super Admin)
 * Always renders the governance layout. KPI cards and partner lists
 * populate from live API data; zero-states show dashes, not a blank page.
 */
function DashboardOverview() {
    const navigate = useNavigate();

    const [retailers, setRetailers] = React.useState([]);
    const [advertisers, setAdvertisers] = React.useState([]);
    const [screens, setScreens] = React.useState([]);
    const [platformUsers, setPlatformUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const API_URL = window.__API_URL__ || '';
        const headers = { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` };

        Promise.allSettled([
            fetch(`${API_URL}/api/retailers`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/api/advertisers`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/api/screens`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/api/users`, { headers }).then(r => r.json()),
        ]).then(([rRes, aRes, sRes, uRes]) => {
            if (rRes.status === 'fulfilled') setRetailers(rRes.value?.retailers || rRes.value?.data || []);
            if (aRes.status === 'fulfilled') setAdvertisers(aRes.value?.advertisers || aRes.value?.data || []);
            if (sRes.status === 'fulfilled') setScreens(sRes.value?.screens || sRes.value?.data || []);
            if (uRes.status === 'fulfilled') setPlatformUsers(uRes.value?.users || uRes.value?.data || []);
            setLoading(false);
        });
    }, []);

    const screensOnline = screens.filter(s => s.status === 'online' || s.status === 'active').length;

    // ── quick-nav tiles (top icon grid) ──────────────────────────────
    const quickNavTiles = [
        { icon: '$', label: 'CPM Pricing',   route: '/dashboard/admin/cpm-pricing' },
        { icon: '👥', label: 'Users',        route: '/dashboard/admin/users' },
        { icon: '🏪', label: 'Retailers',    route: '/dashboard/admin/retailers' },
        { icon: '📢', label: 'Advertisers',  route: '/dashboard/admin/advertisers' },
        { icon: '▶', label: 'Demo Player',   route: '/player/demo' },
        { icon: '🕐', label: 'Store Hours',  route: '/dashboard/admin/business-hours' },
        { icon: '🗺', label: 'Network Map',  route: '/dashboard/admin/network-map' },
    ];

    // ── styles ────────────────────────────────────────────────────────
    const page = {
        padding: '2rem 2.5rem',
        background: '#f3f4f6',
        minHeight: '100%',
    };

    const headerRow = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.75rem',
    };

    const tileGrid = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem',
    };

    const tile = {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '1.25rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6rem',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
    };

    const tileIcon = {
        width: 40,
        height: 40,
        borderRadius: 8,
        background: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
    };

    const kpiGrid = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem',
    };

    const kpiCard = (accent) => ({
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${accent}`,
        borderRadius: '10px',
        padding: '1.25rem 1.5rem',
    });

    const twoCol = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.25rem',
    };

    const listCard = {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '1.25rem 1.5rem',
    };

    const listRow = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 0',
        borderBottom: '1px solid #f3f4f6',
    };

    const avatar = {
        width: 36,
        height: 36,
        borderRadius: 8,
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        marginRight: '0.75rem',
        flexShrink: 0,
    };

    const badgeGreen = {
        background: '#dcfce7',
        color: '#166534',
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 99,
    };

    const btnPrimary = {
        background: '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '0.5rem 1.1rem',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
    };

    const btnSecondary = {
        background: '#fff',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: '0.5rem 1.1rem',
        fontWeight: 500,
        fontSize: '0.875rem',
        cursor: 'pointer',
    };

    return (
        <div style={page}>

            {/* ── Page Header ─────────────────────────────────── */}
            <div style={headerRow}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                        Platform Governance
                    </h1>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                        Softomedia Super Admin Control Center
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button style={btnPrimary} onClick={() => navigate('/dashboard/admin/retailers')}>
                        + New Retailer
                    </button>
                    <button style={btnSecondary} onClick={() => navigate('/dashboard/admin/network-map')}>
                        Network Map
                    </button>
                </div>
            </div>

            {/* ── Quick-Nav Tiles ──────────────────────────────── */}
            <div style={tileGrid}>
                {quickNavTiles.map((t) => (
                    <div
                        key={t.label}
                        style={tile}
                        onClick={() => navigate(t.route)}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                        <div style={tileIcon}>{t.icon}</div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', textAlign: 'center' }}>
                            {t.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* ── KPI Cards ────────────────────────────────────── */}
            <div style={kpiGrid}>
                <div style={kpiCard('#3b82f6')}>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>Retailers</p>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {loading ? '—' : retailers.length}
                    </p>
                </div>
                <div style={kpiCard('#f59e0b')}>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>Advertisers</p>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {loading ? '—' : advertisers.length}
                    </p>
                </div>
                <div style={kpiCard('#10b981')}>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>Screens Online</p>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                        {loading ? '—' : screensOnline}
                    </p>
                    {!loading && (
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                            of {screens.length} total
                        </p>
                    )}
                </div>
                <div style={kpiCard('#8b5cf6')}>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>Platform Users</p>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {loading ? '—' : platformUsers.length}
                    </p>
                </div>
            </div>

            {/* ── Partner Lists ─────────────────────────────────── */}
            <div style={twoCol}>

                {/* Retail Partners */}
                <div style={listCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>Retail Partners</h3>
                        <button
                            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
                            onClick={() => navigate('/dashboard/admin/retailers')}
                        >
                            View All →
                        </button>
                    </div>
                    {loading ? (
                        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Loading…</p>
                    ) : retailers.length === 0 ? (
                        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No retailers yet.</p>
                    ) : (
                        retailers.slice(0, 5).map((r) => (
                            <div key={r.id || r.retailer_id} style={listRow}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={avatar}>
                                        {r.logo_url
                                            ? <img src={r.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                                            : '🏪'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>
                                            {r.name || r.business_name || 'Unnamed'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                            {r.location_count ?? 0} Location{r.location_count !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <span style={badgeGreen}>● Active</span>
                            </div>
                        ))
                    )}
                </div>

                {/* Key Advertisers */}
                <div style={listCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>Key Advertisers</h3>
                        <button
                            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
                            onClick={() => navigate('/dashboard/admin/advertisers')}
                        >
                            View All →
                        </button>
                    </div>
                    {loading ? (
                        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Loading…</p>
                    ) : advertisers.length === 0 ? (
                        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No advertisers yet.</p>
                    ) : (
                        advertisers.slice(0, 5).map((a) => (
                            <div key={a.id || a.advertiser_id} style={listRow}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={avatar}>
                                        {a.logo_url
                                            ? <img src={a.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                                            : '📢'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>
                                            {a.name || a.company_name || 'Unnamed'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                            {a.active_campaigns ?? 0} Active Campaign{a.active_campaigns !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                                        ${(a.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', letterSpacing: '0.05em' }}>BUDGET</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}

export default DashboardOverview;
