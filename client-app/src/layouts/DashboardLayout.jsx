import React from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Monitor,
    Users,
    Settings,
    LogOut,
    BarChart2,
    Map,
    Clock,
    List,
    Play,
    Bot,
    ChevronLeft,
    DollarSign,
    Megaphone,
    CalendarDays,
    History,
} from 'lucide-react';

function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('auth_role') || 'admin';

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        navigate('/login');
    };

    const isActive = (path) => {
        if (path === '/dashboard/admin') {
            return location.pathname === '/dashboard/admin';
        }
        return location.pathname.startsWith(path);
    };

    const linkStyle = (path) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        color: isActive(path) ? '#e5e7eb' : '#9ca3af',
        textDecoration: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: isActive(path) ? '500' : '400',
        backgroundColor: isActive(path) ? '#374151' : 'transparent',
        transition: 'background-color 150ms, color 150ms',
    });

    const sectionLabel = (text) => (
        <li style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase' }}>
            {text}
        </li>
    );

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f3f4f6' }}>
            {/* Sidebar */}
            <aside style={{
                width: '240px',
                backgroundColor: '#111827',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflowY: 'auto',
            }}>
                <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #1f2937' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f9fafb' }}>SoftoMedia</div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.125rem' }}>{role} Portal</div>
                </div>

                <nav style={{ flex: 1, padding: '0.75rem 0.5rem' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>

                        {/* ── Admin ── */}
                        {role === 'admin' && (
                            <>
                                {sectionLabel('Overview')}
                                <li><Link to="/dashboard/admin" style={linkStyle('/dashboard/admin')}><LayoutDashboard size={16} />Dashboard</Link></li>

                                {sectionLabel('Content')}
                                <li><Link to="/dashboard/admin/screens" style={linkStyle('/dashboard/admin/screens')}><Monitor size={16} />Screens</Link></li>
                                <li><Link to="/dashboard/admin/playlists" style={linkStyle('/dashboard/admin/playlists')}><Play size={16} />Playlists</Link></li>
                                <li><Link to="/dashboard/admin/loops" style={linkStyle('/dashboard/admin/loops')}><List size={16} />Loops</Link></li>

                                {sectionLabel('Network')}
                                <li><Link to="/dashboard/admin/retailers" style={linkStyle('/dashboard/admin/retailers')}><Users size={16} />Retailers</Link></li>
                                <li><Link to="/dashboard/admin/advertisers" style={linkStyle('/dashboard/admin/advertisers')}><Megaphone size={16} />Advertisers</Link></li>
                                <li><Link to="/dashboard/admin/hours" style={linkStyle('/dashboard/admin/hours')}><Clock size={16} />Business Hours</Link></li>

                                {sectionLabel('Analytics')}
                                <li><Link to="/dashboard/admin/analytics" style={linkStyle('/dashboard/admin/analytics')}><BarChart2 size={16} />Loop Analytics</Link></li>
                                <li><Link to="/dashboard/admin/map" style={linkStyle('/dashboard/admin/map')}><Map size={16} />Network Map</Link></li>

                                {sectionLabel('Admin')}
                                <li><Link to="/dashboard/admin/pricing" style={linkStyle('/dashboard/admin/pricing')}><DollarSign size={16} />CPM Pricing</Link></li>
                                <li><Link to="/dashboard/admin/users" style={linkStyle('/dashboard/admin/users')}><Users size={16} />Users</Link></li>
                                <li><Link to="/dashboard/admin/ai-log" style={linkStyle('/dashboard/admin/ai-log')}><Bot size={16} />AI Log</Link></li>
                                <li><Link to="/dashboard/tech" style={linkStyle('/dashboard/tech')}><Monitor size={16} />Tech Ops</Link></li>
                                <li><Link to="/dashboard/health" style={linkStyle('/dashboard/health')}><Settings size={16} />Health</Link></li>
                            </>
                        )}

                        {/* ── Brand ── */}
                        {role === 'brand' && (
                            <>
                                {sectionLabel('Campaigns')}
                                <li><Link to="/dashboard/brand" style={linkStyle('/dashboard/brand')}><LayoutDashboard size={16} />Dashboard</Link></li>
                                <li><Link to="/dashboard/brand/campaign/new" style={linkStyle('/dashboard/brand/campaign/new')}><Megaphone size={16} />New Campaign</Link></li>
                            </>
                        )}

                        {/* ── Retailer ── */}
                        {role === 'retailer' && (
                            <>
                                {sectionLabel('My Network')}
                                <li><Link to="/dashboard/retailer" style={linkStyle('/dashboard/retailer')}><LayoutDashboard size={16} />Dashboard</Link></li>
                                <li><Link to="/dashboard/retailer/schedule" style={linkStyle('/dashboard/retailer/schedule')}><CalendarDays size={16} />Schedule</Link></li>
                                <li><Link to="/dashboard/retailer/schedule/calendar" style={linkStyle('/dashboard/retailer/schedule/calendar')}><CalendarDays size={16} />Calendar</Link></li>
                                <li><Link to="/dashboard/retailer/history" style={linkStyle('/dashboard/retailer/history')}><History size={16} />History</Link></li>
                            </>
                        )}

                        {/* ── Tech ── */}
                        {role === 'tech' && (
                            <>
                                {sectionLabel('Operations')}
                                <li><Link to="/dashboard/tech" style={linkStyle('/dashboard/tech')}><Monitor size={16} />Tech Ops</Link></li>
                                <li><Link to="/dashboard/health" style={linkStyle('/dashboard/health')}><Settings size={16} />Health</Link></li>
                            </>
                        )}

                    </ul>
                </nav>

                <div style={{ padding: '0.75rem 0.5rem', borderTop: '1px solid #1f2937' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            borderRadius: '0.375rem',
                        }}
                    >
                        <LogOut size={16} aria-hidden="true" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <header style={{
                    backgroundColor: 'white',
                    padding: '0.875rem 1.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexShrink: 0,
                }}>
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#6b7280',
                            padding: '0.25rem',
                            borderRadius: '0.25rem',
                        }}
                    >
                        <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <h1 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                        {location.pathname
                            .split('/')
                            .filter(Boolean)
                            .pop()
                            ?.replace(/-/g, ' ')
                            ?.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Dashboard'}
                    </h1>
                </header>

                <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default DashboardLayout;
