import React, { useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PersonaSwitcher from '../components/PersonaSwitcher';
import { useAuth } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import SafeWidgetLoader from '../components/SafeWidgetLoader';
import NetworkErrorBanner from '../components/NetworkErrorBanner';

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

    // Role-based routing: map persona to an existing route.
    React.useEffect(() => {
        if (!loading && persona && location.pathname === '/dashboard') {
            const routePersona = persona === 'super_admin' ? 'admin' : persona;
            navigate(`/dashboard/${routePersona}`, { replace: true });
        }
    }, [persona, loading, location.pathname, navigate]);

    if (loading) return null;

    const avatarUrl = user?.avatarUrl || user?.photoURL || null;
    const avatarInitial = user?.name ? user.name[0].toUpperCase()
        : user?.email ? user.email[0].toUpperCase()
        : persona ? persona[0].toUpperCase()
        : '?';

    const handleLogout = () => {
        setAvatarOpen(false);
        logout();
        navigate('/login');
    };

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white relative ${!loading ? 'main-content-loaded' : ''}`}>
            {/* T1: Network error banner — fixed position, zero layout shift */}
            <NetworkErrorBanner />

            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-background-dark/90 backdrop-blur-md px-6 py-3 lg:px-10">
                <div className="flex items-center gap-4">
                    <div className="size-8 text-primary">
                        <span className="material-symbols-outlined text-[32px]">campaign</span>
                    </div>
                    <h2 className="text-lg font-bold leading-tight tracking-tight">AdManager</h2>
                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>
                    <PersonaSwitcher />
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

            <main className="p-4 lg:p-10 max-w-[1440px] mx-auto">
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>

            {/* AI Assistant (Ghost Layer) */}
            <SafeWidgetLoader />
        </div>
    );
}

export default DashboardLayout;
