import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Variant B — Compact Top Sheet
 * Drops down directly below the sticky header (top-14).
 * Same props/data as HamburgerMenu (A).
 * Layout: 3-column grid on sm+ (nav | roles | account), stacked on mobile.
 * Backdrop covers content area only (not the header).
 * Trigger icon morphs between menu ↔ close while open.
 */

const PERSONA_SWATCHES = [
    { label: 'Super Admin', role: 'super_admin', color: 'bg-purple-500', route: 'admin'    },
    { label: 'Admin',       role: 'admin',       color: 'bg-blue-500',   route: 'admin'    },
    { label: 'Brand',       role: 'brand',       color: 'bg-rose-500',   route: 'brand'    },
    { label: 'Retailer',    role: 'retailer',    color: 'bg-amber-500',  route: 'retailer' },
    { label: 'Tech Op',     role: 'tech',        color: 'bg-slate-500',  route: 'admin'    },
];

function HamburgerMenuB() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, login, logout } = useAuth();
    const navigate = useNavigate();

    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, close]);

    // No body scroll lock — sheet is below header, page is still visible

    const navItems = [
        { label: 'Dashboard',   path: '/dashboard/admin',               icon: 'dashboard'     },
        { label: 'Demo Player', path: '/player/demo',                   icon: 'slideshow'     },
        { label: 'Health',      path: '/dashboard/health',              icon: 'monitor_heart' },
        ...(user?.role === 'brand' ? [
            { label: 'New Campaign', path: '/dashboard/brand/campaign/new', icon: 'add_circle' }
        ] : []),
    ];

    const switchPersona = (swatch) => {
        const mockUser = {
            id: `demo-${swatch.role}`,
            name: swatch.label,
            email: `${swatch.role}@demo.softomedia.com`,
            role: swatch.role,
            linked_entity_id: `entity-${swatch.role}`
        };
        localStorage.setItem('demo_role', swatch.role);
        login(mockUser, 'demo-token');
        close();
        navigate(`/dashboard/${swatch.route}`);
    };

    const avatarInitial = user?.name?.[0]?.toUpperCase() ?? '?';

    return (
        <>
            {/* Trigger — icon morphs menu ↔ close */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isOpen}
                aria-controls="hamburger-sheet-b"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <span className="material-symbols-outlined" aria-hidden="true">
                    {isOpen ? 'close' : 'menu'}
                </span>
            </button>

            {isOpen && (
                /*
                 * Wrapper is sticky top-14 so the sheet sits flush below the header.
                 * Backdrop covers the viewport below the header only.
                 */
                <div className="fixed inset-0 top-14 z-40" id="hamburger-sheet-b">
                    {/* Backdrop — content area only */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
                        onClick={close}
                        aria-hidden="true"
                    />

                    {/* Sheet panel */}
                    <div
                        className="relative w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-lg"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation menu"
                        style={{ maxHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}
                    >
                        <div className="max-w-3xl mx-auto px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-6">

                            {/* Col 1 — Nav links */}
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Navigation</p>
                                <nav className="space-y-0.5" aria-label="Main navigation">
                                    {navItems.map(item => (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={close}
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[20px] text-slate-400" aria-hidden="true">{item.icon}</span>
                                            {item.label}
                                        </Link>
                                    ))}
                                </nav>
                            </div>

                            {/* Col 2 — Role switcher */}
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Switch Demo Role</p>
                                <div className="space-y-0.5">
                                    {PERSONA_SWATCHES.map(swatch => {
                                        const isActive = user?.role === swatch.role;
                                        return (
                                            <button
                                                key={swatch.role}
                                                onClick={() => switchPersona(swatch)}
                                                aria-pressed={isActive}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    isActive
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                <span className={`size-2 rounded-full flex-shrink-0 ${swatch.color}`} aria-hidden="true" />
                                                <span className="truncate">{swatch.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Col 3 — Account */}
                            {user && (
                                <div className="flex flex-col gap-3">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Account</p>
                                    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <div className="size-9 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
                                            {avatarInitial}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { logout(); close(); navigate('/login'); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default HamburgerMenuB;
