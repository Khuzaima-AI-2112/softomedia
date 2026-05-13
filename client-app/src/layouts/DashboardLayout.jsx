import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Monitor, Users, Settings, LogOut,
    BarChart2, Map, Clock, List, Play, Bot, DollarSign,
    Megaphone, CalendarDays, History, Ticket, Activity,
    ChevronLeft, Menu, X,
} from 'lucide-react';

// ─── Persona definitions ───────────────────────────────────────────────────
const PERSONAS = [
    { role: 'admin',    label: 'Admin',    route: '/dashboard/admin' },
    { role: 'brand',    label: 'Brand',    route: '/dashboard/brand' },
    { role: 'retailer', label: 'Retailer', route: '/dashboard/retailer' },
    { role: 'tech',     label: 'Tech',     route: '/dashboard/tech' },
];

function pageTitle(pathname) {
    const seg = pathname.split('/').filter(Boolean).pop() || 'overview';
    return seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function SectionLabel({ children }) {
    return (
        <li style={{
            padding: '0.875rem 0.75rem 0.25rem',
            fontSize: '0.7rem',
            fontWeight: '600',
            letterSpacing: '0.09em',
            color: '#6b7280',
            textTransform: 'uppercase',
            userSelect: 'none',
        }}>
            {children}
        </li>
    );
}

function NavLink({ to, icon: Icon, children, active }) {
    return (
        <li>
            <Link
                to={to}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    color: active ? '#f9fafb' : '#9ca3af',
                    textDecoration: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: active ? '500' : '400',
                    backgroundColor: active ? 'rgba(37,99,235,0.15)' : 'transparent',
                    boxShadow: active ? 'inset 2px 0 0 #2563eb' : 'none',
                    transition: 'background-color 150ms, color 150ms, box-shadow 150ms',
                }}
                onMouseEnter={e => {
                    if (!active) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = '#e5e7eb';
                    }
                }}
                onMouseLeave={e => {
                    if (!active) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9ca3af';
                    }
                }}
            >
                <Icon size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                {children}
            </Link>
        </li>
    );
}

function SidebarContent({ role, switchPersona, handleLogout, isActive }) {
    return (
        <>
            <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid #374151' }}>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f9fafb', letterSpacing: '-0.01em', marginBottom: '0.875rem' }}>
                    SoftoMedia
                </div>
                <div
                    role="group"
                    aria-label="Switch persona"
                    style={{
                        display: 'flex',
                        backgroundColor: '#111827',
                        borderRadius: '0.4rem',
                        padding: '2px',
                        gap: '2px',
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
                                flex: 1,
                                padding: '0.25rem 0',
                                fontSize: '0.65rem',
                                fontWeight: '600',
                                letterSpacing: '0.02em',
                                borderRadius: '0.3rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 150ms, color 150ms',
                                backgroundColor: role === p.role ? '#2563eb' : 'transparent',
                                color: role === p.role ? '#ffffff' : '#6b7280',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <nav style={{ flex: 1, padding: '0.5rem 0.75rem', overflowY: 'auto' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>

                    {role === 'admin' && (
                        <>
                            <SectionLabel>Overview</SectionLabel>
                            <NavLink to="/dashboard/admin" icon={LayoutDashboard} active={isActive('/dashboard/admin')}>Dashboard</NavLink>
                            <SectionLabel>Content</SectionLabel>
                            <NavLink to="/dashboard/admin/screens" icon={Monitor} active={isActive('/dashboard/admin/screens')}>Screens</NavLink>
                            <NavLink to="/dashboard/admin/playlists" icon={Play} active={isActive('/dashboard/admin/playlists')}>Playlists</NavLink>
                            <NavLink to="/dashboard/admin/loops" icon={List} active={isActive('/dashboard/admin/loops')}>Loops</NavLink>
                            <SectionLabel>Network</SectionLabel>
                            <NavLink to="/dashboard/admin/retailers" icon={Users} active={isActive('/dashboard/admin/retailers')}>Retailers</NavLink>
                            <NavLink to="/dashboard/admin/advertisers" icon={Megaphone} active={isActive('/dashboard/admin/advertisers')}>Advertisers</NavLink>
                            <NavLink to="/dashboard/admin/hours" icon={Clock} active={isActive('/dashboard/admin/hours')}>Business Hours</NavLink>
                            <SectionLabel>Analytics</SectionLabel>
                            <NavLink to="/dashboard/admin/analytics" icon={BarChart2} active={isActive('/dashboard/admin/analytics')}>Loop Analytics</NavLink>
                            <NavLink to="/dashboard/admin/map" icon={Map} active={isActive('/dashboard/admin/map')}>Network Map</NavLink>
                            <SectionLabel>Admin</SectionLabel>
                            <NavLink to="/dashboard/admin/pricing" icon={DollarSign} active={isActive('/dashboard/admin/pricing')}>CPM Pricing</NavLink>
                            <NavLink to="/dashboard/admin/users" icon={Users} active={isActive('/dashboard/admin/users')}>Users</NavLink>
                            <NavLink to="/dashboard/admin/ai-log" icon={Bot} active={isActive('/dashboard/admin/ai-log')}>AI Log</NavLink>
                            <NavLink to="/dashboard/tech" icon={Monitor} active={isActive('/dashboard/tech')}>Tech Ops</NavLink>
                            <NavLink to="/dashboard/tech/tickets" icon={Ticket} active={isActive('/dashboard/tech/tickets')}>Support Tickets</NavLink>
                            <NavLink to="/dashboard/health" icon={Settings} active={isActive('/dashboard/health')}>Health</NavLink>
                        </>
                    )}

                    {role === 'brand' && (
                        <>
                            <SectionLabel>Campaigns</SectionLabel>
                            <NavLink to="/dashboard/brand" icon={LayoutDashboard} active={isActive('/dashboard/brand')}>Dashboard</NavLink>
                            <NavLink to="/dashboard/brand/campaign/new" icon={Megaphone} active={isActive('/dashboard/brand/campaign/new')}>New Campaign</NavLink>
                        </>
                    )}

                    {role === 'retailer' && (
                        <>
                            <SectionLabel>My Network</SectionLabel>
                            <NavLink to="/dashboard/retailer" icon={LayoutDashboard} active={isActive('/dashboard/retailer')}>Dashboard</NavLink>
                            <NavLink to="/dashboard/retailer/schedule" icon={CalendarDays} active={isActive('/dashboard/retailer/schedule')}>Schedule</NavLink>
                            <NavLink to="/dashboard/retailer/schedule/calendar" icon={CalendarDays} active={isActive('/dashboard/retailer/schedule/calendar')}>Calendar</NavLink>
                            <NavLink to="/dashboard/retailer/history" icon={History} active={isActive('/dashboard/retailer/history')}>History</NavLink>
                        </>
                    )}

                    {role === 'tech' && (
                        <>
                            <SectionLabel>Operations</SectionLabel>
                            <NavLink to="/dashboard/tech" icon={Monitor} active={isActive('/dashboard/tech')}>Tech Ops</NavLink>
                            <NavLink to="/dashboard/tech/tickets" icon={Ticket} active={isActive('/dashboard/tech/tickets')}>Support Tickets</NavLink>
                            <NavLink to="/dashboard/health" icon={Activity} active={isActive('/dashboard/health')}>Health</NavLink>
                        </>
                    )}

                </ul>
            </nav>

            <div style={{ padding: '0.75rem', borderTop: '1px solid #374151' }}>
                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'background-color 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                    <LogOut size={18} aria-hidden="true" />
                    Sign Out
                </button>
            </div>
        </>
    );
}

function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [role, setRole] = useState(
        () => localStorage.getItem('auth_role') || 'admin'
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef(null);

    useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawerOpen]);

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
        if (path === '/dashboard/admin')    return location.pathname === '/dashboard/admin';
        if (path === '/dashboard/brand')    return location.pathname === '/dashboard/brand';
        if (path === '/dashboard/retailer') return location.pathname === '/dashboard/retailer';
        if (path === '/dashboard/tech')     return location.pathname === '/dashboard/tech';
        return location.pathname.startsWith(path);
    };

    const activePersona = PERSONAS.find(p => p.role === role) || PERSONAS[0];

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--color-bg, #f9fafb)', overflow: 'hidden' }}>

            {/* Desktop Sidebar */}
            <aside
                aria-label="Main navigation"
                className="sidebar-desktop"
                style={{
                    width: '240px',
                    backgroundColor: '#111827',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                }}
            >
                <SidebarContent role={role} switchPersona={switchPersona} handleLogout={handleLogout} isActive={isActive} />
            </aside>

            {/* Mobile backdrop */}
            {drawerOpen && (
                <div
                    aria-hidden="true"
                    onClick={() => setDrawerOpen(false)}
                    className="mobile-overlay"
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 39, display: 'none' }}
                />
            )}

            {/* Mobile drawer */}
            <aside
                ref={drawerRef}
                aria-label="Mobile navigation"
                className="sidebar-mobile"
                style={{
                    position: 'fixed',
                    top: 0, left: 0, bottom: 0,
                    width: '280px',
                    backgroundColor: '#111827',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 40,
                    transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 250ms cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: drawerOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 0.75rem 0' }}>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close navigation"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0.25rem', borderRadius: '0.375rem' }}
                    >
                        <X size={20} />
                    </button>
                </div>
                <SidebarContent role={role} switchPersona={switchPersona} handleLogout={handleLogout} isActive={isActive} />
            </aside>

            {/* Main area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Topbar */}
                <header style={{
                    height: '52px',
                    backgroundColor: 'var(--color-surface, #ffffff)',
                    borderBottom: '1px solid var(--color-border, #e5e7eb)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1.5rem',
                    gap: '0.75rem',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)',
                }}>
                    <button
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Open navigation"
                        aria-expanded={drawerOpen}
                        className="hamburger-btn"
                        style={{
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted, #6b7280)',
                            padding: '0.25rem',
                            borderRadius: '0.375rem',
                            flexShrink: 0,
                        }}
                    >
                        <Menu size={20} />
                    </button>

                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-text-faint, #9ca3af)',
                            padding: '0.25rem', borderRadius: '0.375rem', flexShrink: 0,
                            transition: 'color 150ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text, #111827)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-faint, #9ca3af)'}
                    >
                        <ChevronLeft size={18} aria-hidden="true" />
                    </button>

                    <h1 style={{
                        fontSize: '0.9375rem',
                        fontWeight: '600',
                        color: 'var(--color-text, #111827)',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {pageTitle(location.pathname)}
                    </h1>

                    <div style={{ flex: 1 }} />

                    <span
                        aria-label={`Current view: ${activePersona.label}`}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.2rem 0.6rem', borderRadius: '9999px',
                            fontSize: '0.75rem', fontWeight: '500',
                            backgroundColor: 'var(--color-primary-light, #dbeafe)',
                            color: 'var(--color-primary-text, #1e40af)',
                            border: '1px solid rgba(37,99,235,0.2)',
                            whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                    >
                        <span aria-hidden="true" style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #2563eb)', flexShrink: 0,
                        }} />
                        {activePersona.label}
                    </span>

                    <div
                        aria-label="Profile"
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #2563eb)',
                            color: '#ffffff', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700',
                            flexShrink: 0, userSelect: 'none', cursor: 'default',
                        }}
                    >
                        SM
                    </div>
                </header>

                <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
                    <Outlet />
                </main>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .sidebar-desktop { display: none !important; }
                    .hamburger-btn   { display: flex !important; }
                    .mobile-overlay  { display: block !important; }
                }
                @media (min-width: 769px) {
                    .sidebar-mobile  { display: none !important; }
                }
            `}</style>
        </div>
    );
}

export default DashboardLayout;
