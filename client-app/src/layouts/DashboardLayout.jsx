import React, { useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardRouteForRole, ROLES } from '../constants/roles';
import ErrorBoundary from '../components/ErrorBoundary';
import NetworkErrorBanner from '../components/NetworkErrorBanner';

// ── Role-aware sidebar nav items ───────────────────────────────────────────────
const ADMIN_NAV = [
    { to: '/dashboard/admin', icon: 'dashboard', label: 'Overview', end: true, testId: 'nav-home' },
    { to: '/dashboard/admin/retailers', icon: 'storefront', label: 'Retailers' },
    { to: '/dashboard/admin/advertisers', icon: 'campaign', label: 'Advertisers' },
    { to: '/dashboard/admin/campaigns', icon: 'sell', label: 'Campaigns', testId: 'nav-campaigns' },
    { to: '/dashboard/admin/media', icon: 'perm_media', label: 'Media', testId: 'nav-media' },
    { to: '/dashboard/admin/screens', icon: 'tv', label: 'Screens' },
    { to: '/dashboard/admin/loops', icon: 'subscriptions', label: 'Loops' },
    { to: '/dashboard/admin/loop-analytics', icon: 'analytics', label: 'Loop Analytics', testId: 'nav-reports' },
    { to: '/dashboard/admin/users', icon: 'group', label: 'Users' },
    { to: '/dashboard/admin/organizations', icon: 'domain', label: 'Organizations' },
    { to: '/dashboard/admin/hours', icon: 'schedule', label: 'Business Hours' },
    { to: '/dashboard/admin/pricing', icon: 'payments', label: 'Pricing' },
    { to: '/dashboard/admin/pricing-config', icon: 'tune', label: 'Pricing Config' },
    { to: '/dashboard/admin/map', icon: 'map', label: 'Network Map' },
];

// Super Administrators manage every Support Ticket; Admin has no ticket access in Phase 1.
const SUPERADMIN_NAV = [
    ...ADMIN_NAV,
    { to: '/dashboard/tickets', icon: 'confirmation_number', label: 'Support Tickets', testId: 'nav-tickets' },
];

// fix(mvp-nav): add My Campaigns and Performance — MVP §3.4 "track campaign status"
// and "view basic campaign performance metrics" were built but unlinked.
const BRAND_NAV = [
    { to: '/dashboard/brand', icon: 'dashboard', label: 'Dashboard', end: true, testId: 'nav-home' },
    { to: '/dashboard/brand/campaign/new', icon: 'add_circle', label: 'New Campaign' },
    { to: '/dashboard/advertiser/campaigns', icon: 'sell', label: 'My Campaigns', testId: 'nav-campaigns' },
    { to: '/dashboard/advertiser', icon: 'insights', label: 'Performance', end: true, testId: 'nav-reports' },
    { to: '/dashboard/advertiser/invoices', icon: 'receipt_long', label: 'Invoices' },
];

// fix(#26b): add Loops and Campaign Approvals — previously missing from retailer sidebar
const RETAILER_NAV = [
    { to: '/dashboard/retailer', icon: 'dashboard', label: 'Dashboard', end: true, testId: 'nav-home' },
    { to: '/dashboard/retailer/schedule', icon: 'calendar_month', label: 'Schedule', testId: 'nav-calendar' },
    { to: '/dashboard/retailer/schedule-history', icon: 'history', label: 'Schedule History' },
    { to: '/dashboard/retailer/schedule-manager', icon: 'event_available', label: 'D-1 Preview' },
    { to: '/dashboard/retailer/hours', icon: 'schedule', label: 'Store Hours', testId: 'nav-store-hours' },
    { to: '/dashboard/retailer/loops', icon: 'subscriptions', label: 'Loops' },
    { to: '/dashboard/retailer/campaign-approvals', icon: 'approval', label: 'Campaign Approvals', testId: 'nav-approvals' },
    // fix(mvp-nav): MVP §3.2 — communicate feedback or issues to Softomedia
    { to: '/dashboard/tickets', icon: 'confirmation_number', label: 'Support Tickets', testId: 'nav-tickets' },
];

// Task 4.6 — TechOpsDashboard is now the landing page entry; Health remains accessible
const TECHOP_NAV = [
    { to: '/dashboard/techoperator', icon: 'monitor', label: 'Tech Ops', end: true, testId: 'nav-tech-ops' },
    { to: '/dashboard/techoperator/health', icon: 'monitor_heart', label: 'Health' },
    // fix(mvp-nav): MVP §3.5 — register/provision screens and assign them to retailers
    // and locations. ScreenManagement serves both; the Technical Operator holds the
    // screens.manage grant, so the screen renders with data for this persona.
    { to: '/dashboard/techoperator/screens', icon: 'tv', label: 'Screens', testId: 'nav-screens' },
    // fix(mvp-nav): MVP §3.5 — incident tracking and resolution
    { to: '/dashboard/tickets', icon: 'confirmation_number', label: 'Support Tickets', testId: 'nav-tickets' },
];

function getNavItems(persona) {
    if (!persona) return [];
    if (persona === ROLES.SUPERADMIN) return SUPERADMIN_NAV;
    if (persona === ROLES.ADMIN) return ADMIN_NAV;
    if (persona === ROLES.BRAND) return BRAND_NAV;
    if (persona === ROLES.RETAILERADMIN) return RETAILER_NAV;
    if (persona === ROLES.TECHOPERATOR) return TECHOP_NAV;
    return [];
}

function Sidebar({ persona }) {
    const navItems = getNavItems(persona);
    if (!navItems.length) return null;

    let testId = 'nav-admin';
    if (persona === ROLES.BRAND) testId = 'nav-brand';
    else if (persona === ROLES.RETAILERADMIN) testId = 'nav-retailer';
    else if (persona === ROLES.TECHOPERATOR) testId = 'nav-techop';

    return (
        <aside
            aria-label="Main navigation"
            data-testid={testId}
            className="hidden lg:flex flex-col w-56 shrink-0 min-h-screen border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark pt-6 pb-10 px-3"
        >
            <nav>
                <ul className="space-y-0.5" role="list">
                    {navItems.map((item) => (
                        <li key={item.to}>
                            <NavLink
                                to={item.to}
                                end={item.end}
                                data-testid={item.testId}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }`
                                }
                            >
                                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                                    {item.icon}
                                </span>
                                {item.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
}

function DashboardLayout() {
    const { persona, user, loading, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [avatarOpen, setAvatarOpen] = useState(false);
    const avatarRef = useRef(null);

    // Close dropdown on outside click
    React.useEffect(() => {
        if (!avatarOpen) return;
        const handler = (e) => {
            if (avatarRef.current && !avatarRef.current.contains(e.target)) {
                setAvatarOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [avatarOpen]);

    // Task 4.6 — techoperator now lands at /dashboard/techoperator (TechOpsDashboard)
    // Health screen remains accessible via nav but is no longer the default landing page.
    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login', { replace: true });
            return;
        }

        if (!loading && persona && location.pathname === '/dashboard') {
            const route = dashboardRouteForRole(persona);
            if (route) navigate(`/dashboard/${route}`, { replace: true });
        }
    }, [persona, user, loading, location.pathname, navigate]);

    if (loading || !user) return null;

    const avatarUrl = user?.avatarUrl || user?.photoURL || null;
    const avatarInitial = user?.name ? user.name[0].toUpperCase()
        : user?.email ? user.email[0].toUpperCase()
            : persona ? persona[0].toUpperCase()
                : '?';

    const handleLogout = async () => {
        setAvatarOpen(false);
        await logout();
        navigate('/login');
    };

    return (
        <div data-testid="dashboard-shell" className={`min-h-screen bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white relative ${!loading ? 'main-content-loaded' : ''}`}>
            {/* T1: Network error banner — fixed position, zero layout shift */}
            <NetworkErrorBanner />

            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-background-dark/90 backdrop-blur-md px-6 py-3 lg:px-10">
                <div className="flex items-center gap-4">
                    <div className="size-8 text-primary">
                        <span className="material-symbols-outlined text-[32px]">campaign</span>
                    </div>
                    <h2 className="text-lg font-bold leading-tight tracking-tight">AdManager</h2>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                            {persona?.toUpperCase()} MODE
                        </span>
                        <span className="text-[10px] text-slate-500">Live Infrastructure</span>
                    </div>

                    {/* Avatar + identity dropdown */}
                    <div className="relative" ref={avatarRef}>
                        <button
                            data-testid="btn-user-profile"
                            onClick={() => setAvatarOpen(prev => !prev)}
                            aria-label="User menu"
                            aria-expanded={avatarOpen}
                            aria-haspopup="true"
                            className="size-10 rounded-full bg-slate-300 dark:bg-slate-600 bg-center bg-cover border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-200 hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : {}}
                        >
                            {!avatarUrl && avatarInitial}
                        </button>

                        {avatarOpen && (
                            <div
                                className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg py-1 z-[200]"
                                role="menu"
                                aria-label="User options"
                            >
                                {/* Identity */}
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {user?.name || persona}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate mt-0.5">
                                        {user?.email || `${persona}@demo.softomedia.com`}
                                    </p>
                                </div>

                                {/* Logout */}
                                <div className="px-2 py-1">
                                    <button
                                        data-testid="btn-logout"
                                        onClick={handleLogout}
                                        role="menuitem"
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
                                        Log out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Body: sidebar + main */}
            <div className="flex">
                <Sidebar persona={persona} />
                <main className="flex-1 min-w-0 p-4 lg:p-10 max-w-[1440px] mx-auto">
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </div>

        </div>
    );
}

export default DashboardLayout;
