import React, { useState } from 'react';
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
    DollarSign,
    Megaphone,
    CalendarDays,
    History,
    Ticket,
    Activity,
    ChevronLeft,
    ShieldCheck,
    Tv2,
    Wrench,
} from 'lucide-react';

// Persona definitions — label, route root, icon label, key
const PERSONAS = [
    { role: 'admin',    label: 'Admin',    route: '/dashboard/admin',    color: '#6366f1' },
    { role: 'brand',    label: 'Brand',    route: '/dashboard/brand',    color: '#10b981' },
    { role: 'retailer', label: 'Retailer', route: '/dashboard/retailer', color: '#f59e0b' },
    { role: 'tech',     label: 'Tech',     route: '/dashboard/tech',     color: '#3b82f6' },
];

function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    // Initialise from localStorage; fall back to 'admin'
    const [role, setRole] = useState(
        () => localStorage.getItem('auth_role') || 'admin'
    );

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('user_data');
        navigate('/login');
    };

    const switchPersona = (newRole) => {
        localStorage.setItem('auth_role', newRole);
        setRole(newRole);
        const persona = PERSONAS.find(p => p.role === newRole);
        navigate(persona.route);
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
        padding: '0.75rem',
        color: isActive(path) ? '#e5e7eb' : '#9ca3af',
        textDecoration: 'none',
        borderRadius: '0.375rem',
        fontWeight: isActive(path) ? '500' : '400',
        backgroundColor: isActive(path) ? '#374151' : 'transparent',
        transition: 'background-color 150ms, color 150ms',
    });

    const sectionLabel = (text) => (
        <li style={{
            padding: '0.75rem 0.75rem 0.25rem',
            fontSize: '0.7rem',
            fontWeight: '600',
            letterSpacing: '0.08em',
            color: '#6b7280',
            textTransform: 'uppercase',
        }}>
            {text}
        </li>
    );

    const activePersona = PERSONAS.find(p => p.role === role) || PERSONAS[0];

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f3f4f6' }}>
            {/* Sidebar */}
            <aside style={{
                width: '250px',
                backgroundColor: '#1f2937',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflowY: 'auto',
            }}>
                {/* Brand + persona switcher */}
                <div style={{ padding: '1.5rem 1rem 1rem', borderBottom: '1px solid #374151' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f9fafb', marginBottom: '0.25rem' }}>SoftoMedia</h1>

                    {/* Role pill row */}
                    <div
                        role="group"
                        aria-label="Switch persona"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '0.25rem',
                            marginTop: '0.75rem',
                        }}
                    >
                        {PERSONAS.map(p => (
                            <button
                                key={p.role}
                                data-testid={`persona-${p.role}`}
                                aria-label={`Switch to ${p.label} view`}
                                aria-pressed={role === p.role}
                                onClick={() => switchPersona(p.role)}
                                style={{
                                    padding: '0.3rem 0',
                                    fontSize: '0.65rem',
                                    fontWeight: '600',
                                    letterSpacing: '0.03em',
                                    textTransform: 'uppercase',
                                    borderRadius: '0.25rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'background-color 150ms, color 150ms',
                                    backgroundColor: role === p.role ? p.color : '#374151',
                                    color: role === p.role ? '#ffffff' : '#9ca3af',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <nav style={{ flex: 1, padding: '1rem' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>

                        {/* ── Admin ── */}
                        {role === 'admin' && (
                            <>
                                {sectionLabel('Overview')}
                                <li><Link to="/dashboard/admin" style={linkStyle('/dashboard/admin')}><LayoutDashboard size={20} aria-hidden="true" />Dashboard</Link></li>

                                {sectionLabel('Content')}
                                <li><Link to="/dashboard/admin/screens" style={linkStyle('/dashboard/admin/screens')}><Monitor size={20} aria-hidden="true" />Screens</Link></li>
                                <li><Link to="/dashboard/admin/playlists" style={linkStyle('/dashboard/admin/playlists')}><Play size={20} aria-hidden="true" />Playlists</Link></li>
                                <li><Link to="/dashboard/admin/loops" style={linkStyle('/dashboard/admin/loops')}><List size={20} aria-hidden="true" />Loops</Link></li>

                                {sectionLabel('Network')}
                                <li><Link to="/dashboard/admin/retailers" style={linkStyle('/dashboard/admin/retailers')}><Users size={20} aria-hidden="true" />Retailers</Link></li>
                                <li><Link to="/dashboard/admin/advertisers" style={linkStyle('/dashboard/admin/advertisers')}><Megaphone size={20} aria-hidden="true" />Advertisers</Link></li>
                                <li><Link to="/dashboard/admin/hours" style={linkStyle('/dashboard/admin/hours')}><Clock size={20} aria-hidden="true" />Business Hours</Link></li>

                                {sectionLabel('Analytics')}
                                <li><Link to="/dashboard/admin/analytics" style={linkStyle('/dashboard/admin/analytics')}><BarChart2 size={20} aria-hidden="true" />Loop Analytics</Link></li>
                                <li><Link to="/dashboard/admin/map" style={linkStyle('/dashboard/admin/map')}><Map size={20} aria-hidden="true" />Network Map</Link></li>

                                {sectionLabel('Admin')}
                                <li><Link to="/dashboard/admin/pricing" style={linkStyle('/dashboard/admin/pricing')}><DollarSign size={20} aria-hidden="true" />CPM Pricing</Link></li>
                                <li><Link to="/dashboard/admin/users" style={linkStyle('/dashboard/admin/users')}><Users size={20} aria-hidden="true" />Users</Link></li>
                                <li><Link to="/dashboard/admin/ai-log" style={linkStyle('/dashboard/admin/ai-log')}><Bot size={20} aria-hidden="true" />AI Log</Link></li>
                                <li><Link to="/dashboard/tech" style={linkStyle('/dashboard/tech')}><Monitor size={20} aria-hidden="true" />Tech Ops</Link></li>
                                <li><Link to="/dashboard/tech/tickets" style={linkStyle('/dashboard/tech/tickets')}><Ticket size={20} aria-hidden="true" />Support Tickets</Link></li>
                                <li><Link to="/dashboard/health" style={linkStyle('/dashboard/health')}><Settings size={20} aria-hidden="true" />Health</Link></li>
                            </>
                        )}

                        {/* ── Brand ── */}
                        {role === 'brand' && (
                            <>
                                {sectionLabel('Campaigns')}
                                <li><Link to="/dashboard/brand" style={linkStyle('/dashboard/brand')}><LayoutDashboard size={20} aria-hidden="true" />Dashboard</Link></li>
                                <li><Link to="/dashboard/brand/campaign/new" style={linkStyle('/dashboard/brand/campaign/new')}><Megaphone size={20} aria-hidden="true" />New Campaign</Link></li>
                            </>
                        )}

                        {/* ── Retailer ── */}
                        {role === 'retailer' && (
                            <>
                                {sectionLabel('My Network')}
                                <li><Link to="/dashboard/retailer" style={linkStyle('/dashboard/retailer')}><LayoutDashboard size={20} aria-hidden="true" />Dashboard</Link></li>
                                <li><Link to="/dashboard/retailer/schedule" style={linkStyle('/dashboard/retailer/schedule')}><CalendarDays size={20} aria-hidden="true" />Schedule</Link></li>
                                <li><Link to="/dashboard/retailer/schedule/calendar" style={linkStyle('/dashboard/retailer/schedule/calendar')}><CalendarDays size={20} aria-hidden="true" />Calendar</Link></li>
                                <li><Link to="/dashboard/retailer/history" style={linkStyle('/dashboard/retailer/history')}><History size={20} aria-hidden="true" />History</Link></li>
                            </>
                        )}

                        {/* ── Tech ── */}
                        {role === 'tech' && (
                            <>
                                {sectionLabel('Operations')}
                                <li><Link to="/dashboard/tech" style={linkStyle('/dashboard/tech')}><Monitor size={20} aria-hidden="true" />Tech Ops</Link></li>
                                <li><Link to="/dashboard/tech/tickets" style={linkStyle('/dashboard/tech/tickets')}><Ticket size={20} aria-hidden="true" />Support Tickets</Link></li>
                                <li><Link to="/dashboard/health" style={linkStyle('/dashboard/health')}><Activity size={20} aria-hidden="true" />Health</Link></li>
                            </>
                        )}

                    </ul>
                </nav>

                <div style={{ padding: '1rem', borderTop: '1px solid #374151' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            borderRadius: '0.375rem',
                        }}
                    >
                        <LogOut size={20} aria-hidden="true" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <header style={{
                    backgroundColor: 'white',
                    padding: '1rem 2rem',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
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
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                        {location.pathname
                            .split('/')
                            .filter(Boolean)
                            .pop()
                            ?.replace(/-/g, ' ')
                            ?.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Overview'}
                    </h2>

                    {/* Active persona badge in header */}
                    <span style={{
                        marginLeft: 'auto',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        backgroundColor: activePersona.color + '22',
                        color: activePersona.color,
                        border: `1px solid ${activePersona.color}44`,
                    }}>
                        {activePersona.label} view
                    </span>
                </header>

                <div style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default DashboardLayout;
