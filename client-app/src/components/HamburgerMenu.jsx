import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Phase 1: role strings normalised to canonical values.
// 'super_admin' → 'superadmin'  (matches server ROLE_HIERARCHY)
const PERSONA_SWATCHES = [
    { label: 'Super Admin', role: 'superadmin', color: 'bg-purple-500', route: 'admin'    },
    { label: 'Admin',       role: 'admin',       color: 'bg-blue-500',   route: 'admin'    },
    { label: 'Brand',       role: 'advertiser',  color: 'bg-rose-500',   route: 'brand'    },
    { label: 'Retailer',    role: 'retaileradmin', color: 'bg-amber-500', route: 'retailer' },
    { label: 'Tech Op',     role: 'techoperator', color: 'bg-slate-500', route: 'admin'    },
];

function HamburgerMenu() {
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

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const navItems = [
        { label: 'Dashboard',   path: '/dashboard/admin',               icon: 'dashboard'     },
        { label: 'Demo Player', path: '/player/demo',                   icon: 'slideshow'     },
        { label: 'Health',      path: '/dashboard/health',              icon: 'monitor_heart' },
        ...(user?.role === 'advertiser' ? [
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
        // Phase 2: explicitly set demo_role so the API interceptor
        // sends the correct x-demo-role header after persona switch
        localStorage.setItem('demo_role', swatch.role);
        login(mockUser, 'demo-token');
        close();
        navigate(`/dashboard/${swatch.route}`);
    };

    const avatarInitial = user?.name?.[0]?.toUpperCase() ?? '?';

    return (
        <>
            {/* Trigger button */}
            <button
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isOpen}
                aria-controls="hamburger-drawer"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <span className="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Navigation menu"
                    id="hamburger-drawer"
                >
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={close}
                        aria-hidden="true"
                    />

                    <div className="relative flex flex-col w-72 h-full bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-200">

                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">campaign</span>
                                <span className="font-bold text-slate-900 dark:text-white">AdManager</span>
                            </div>
                            <button
                                onClick={close}
                                aria-label="Close menu"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                            </button>
                        </div>

                        {/* Nav links */}
                        <nav
                            className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5"
                            aria-label="Main navigation"
                        >
                            {navItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={close}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px] text-slate-400" aria-hidden="true">{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Role switcher */}
                        <div className="flex-shrink-0 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Switch Demo Role</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {PERSONA_SWATCHES.map(swatch => {
                                    const isActive = user?.role === swatch.role;
                                    return (
                                        <button
                                            key={swatch.role}
                                            onClick={() => switchPersona(swatch)}
                                            aria-pressed={isActive}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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

                        {/* User footer */}
                        {user && (
                            <div className="flex-shrink-0 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="size-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
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
            )}
        </>
    );
}

export default HamburgerMenu;
