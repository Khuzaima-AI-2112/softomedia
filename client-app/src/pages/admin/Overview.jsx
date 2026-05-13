import React from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../../services/api.js';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import HamburgerMenu from '../../components/HamburgerMenu';
import EmptyState from '../../components/EmptyState';
import '../../design-tokens.css';

/**
 * DashboardOverview — God View (Super Admin Dashboard)
 * Shows live network stats + persona preview cards for Brand / Retailer / Advertiser
 */
function DashboardOverview() {
    const navigate = useNavigate();
    // Fixed: was incorrectly reading 'softomedia_role' — now reads 'auth_role' to match api.js
    const role = localStorage.getItem('auth_role') || 'admin';
    const [screens, setScreens] = React.useState([]);
    const [ads, setAds] = React.useState([]);
    const [stats, setStats] = React.useState({ active: 0, impressions: 0, playTime: 0 });
    const [userCounts, setUserCounts] = React.useState({ brands: 0, retailers: 0, advertisers: 0 });

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const API_URL = window.__API_URL__ || '';

                // Fetch Screens
                const screensRes = await fetch(`${API_URL}/api/screens`);
                const screensData = await screensRes.json();

                // Fetch Ads
                const adsRes = await fetch(`${API_URL}/api/ads`);
                const adsData = await adsRes.json();

                // Fetch Users (for persona counts)
                const usersRes = await fetch(`${API_URL}/api/users`);
                const usersData = await usersRes.json();

                if (screensData.screens) {
                    setScreens(screensData.screens);
                    const active = screensData.screens.length;
                    const impressions = screensData.screens.reduce((acc, s) => acc + (s.stats?.total_impressions || 0), 0);
                    const playTime = screensData.screens.reduce((acc, s) => acc + (s.stats?.total_play_time || 0), 0);
                    setStats({ active, impressions, playTime });
                }

                if (adsData.ads) {
                    setAds(adsData.ads);
                }

                if (usersData.users) {
                    const brands = usersData.users.filter(u => u.role === 'brand').length;
                    const retailers = usersData.users.filter(u => u.role === 'retailer').length;
                    const advertisers = usersData.users.filter(u => u.role === 'advertiser').length;
                    setUserCounts({ brands, retailers, advertisers });
                }

            } catch (e) {
                console.error('Failed to fetch dashboard data', e);
            }
        };

        fetchData();
    }, []);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const personaCardStyle = {
        backgroundColor: 'white',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid #e5e7eb',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    };

    const personaButtonStyle = (color) => ({
        padding: '0.5rem 1rem',
        backgroundColor: color,
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        alignSelf: 'flex-start',
    });

    const personas = [
        {
            label: 'Brands',
            count: userCounts.brands,
            description: 'Upload creatives, launch campaigns, track performance.',
            route: '/dashboard/brand',
            color: '#7c3aed',
            icon: '🎯',
        },
        {
            label: 'Retailers',
            count: userCounts.retailers,
            description: 'Manage screens, approve schedules, view play history.',
            route: '/dashboard/retailer',
            color: '#0891b2',
            icon: '🏪',
        },
        {
            label: 'Advertisers',
            count: userCounts.advertisers,
            description: 'Set CPM budgets, review placements, monitor ROI.',
            route: '/dashboard/admin/advertisers',
            color: '#059669',
            icon: '📊',
        },
    ];

    return (
        <>
            <HamburgerMenu />
            <div className="dashboard-ui" style={{ padding: 'var(--space-6)' }}>

                {/* Empty State */}
                {screens.length === 0 && ads.length === 0 && (
                    <EmptyState
                        title="Welcome to SoftoMedia"
                        message="Your network is ready to go. Start by adding screens or uploading your first ad campaign."
                        ctaText="Get Started"
                        onCtaClick={() => navigate('/dashboard/admin/screens')}
                        illustration="🎯"
                    />
                )}

                {/* Hero Metrics */}
                {(screens.length > 0 || ads.length > 0) && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                            <GlassCard>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Active Screens</p>
                                <p style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginTop: 'var(--space-2)', fontVariantNumeric: 'tabular-nums' }}>
                                    {stats.active}
                                </p>
                            </GlassCard>
                            <GlassCard>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Total Impressions</p>
                                <p style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginTop: 'var(--space-2)', fontVariantNumeric: 'tabular-nums' }}>
                                    {stats.impressions.toLocaleString()}
                                </p>
                            </GlassCard>
                            <GlassCard>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Total Play Time</p>
                                <p style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)', marginTop: 'var(--space-2)', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatTime(stats.playTime)}
                                </p>
                            </GlassCard>
                        </div>

                        {/* ── Persona Preview (God View) ── */}
                        <div style={{ marginBottom: 'var(--space-8)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                                User Personas — Preview as any role
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                                {personas.map((p) => (
                                    <div key={p.label} style={personaCardStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827' }}>{p.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.count} user{p.count !== 1 ? 's' : ''}</div>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>{p.description}</p>
                                        <button
                                            style={personaButtonStyle(p.color)}
                                            onClick={() => navigate(p.route)}
                                        >
                                            View as {p.label.slice(0, -1)} →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Campaign Performance */}
                        <GlassCard title="Campaign Performance" style={{ marginBottom: 'var(--space-8)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-6)' }}>
                                {ads.map(ad => (
                                    <div key={ad.id} style={{ backgroundColor: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                                        <div style={{ height: '120px', backgroundColor: '#f3f4f6', position: 'relative' }}>
                                            <img
                                                src={ad.thumbnail_url}
                                                alt={ad.title}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none' }}
                                            />
                                        </div>
                                        <div style={{ padding: 'var(--space-4)' }}>
                                            <h4 style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.title}</h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                                                <span>Views</span>
                                                <span style={{ fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>{(ad.stats?.impressions || 0).toLocaleString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                                <span>Duration</span>
                                                <span>{ad.duration_seconds}s</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>

                        {/* Screen Performance Table */}
                        <GlassCard title="Screen Performance" style={{ marginBottom: 'var(--space-8)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Screen ID</th>
                                            <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Status</th>
                                            <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Impressions</th>
                                            <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Play Time</th>
                                            <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Last Seen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {screens.map(screen => (
                                            <tr key={screen.screen_id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-medium)' }}>{screen.screen_id}</td>
                                                <td style={{ padding: 'var(--space-3)' }}><StatusBadge status={screen.status} /></td>
                                                <td style={{ padding: 'var(--space-3)' }}>{(screen.stats?.total_impressions || 0).toLocaleString()}</td>
                                                <td style={{ padding: 'var(--space-3)' }}>{formatTime(screen.stats?.total_play_time || 0)}</td>
                                                <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                                    {screen.last_seen ? new Date(screen.last_seen).toLocaleString() : 'Never'}
                                                </td>
                                            </tr>
                                        ))}
                                        {screens.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No screens found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>

                        <GlassCard>
                            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
                                Welcome back, {role}!
                            </h3>
                            <p style={{ color: 'var(--color-text-secondary)' }}>
                                This is your central command center. Use the sidebar to manage your
                                {role === 'admin' ? ' entire network, users, and global settings.' :
                                    role === 'advertiser' ? ' campaigns, creatives, and budget.' :
                                        ' screens, playlists, and location settings.'}
                            </p>
                        </GlassCard>
                    </>
                )}
            </div>
        </>
    );
}

export default DashboardOverview;
