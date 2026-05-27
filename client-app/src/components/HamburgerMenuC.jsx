import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Variant C — Right-Side Wide Drawer (w-80)
 * Trigger lives on the right end of the header (pass as sibling, not first child).
 * Active route is highlighted with bg-primary/10 text-primary.
 * Role switcher: full-width single-column list, size-3 dots, check icon on active.
 * User card: ring-2 ring-primary/30 avatar, inline role badge, bordered logout.
 */

const PERSONA_SWATCHES = [
    { label: 'Super Admin', role: 'super_admin', color: 'bg-purple-500', route: 'admin'    },
    { label: 'Admin',       role: 'admin',       color: 'bg-blue-500',   route: 'admin'    },
    { label: 'Brand',       role: 'brand',       color: 'bg-rose-500',   route: 'brand'    },
    { label: 'Retailer',    role: 'retailer',    color: 'bg-amber-500',  route: 'retailer' },
    { label: 'Tech Op',     role: 'tech',        color: 'bg-slate-500',  route: 'admin'    },
];

const ROLE_BADGE_CLASSES = {
    super_admin: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    admin:       'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
    brand:       'bg-rose-100   dark:bg-rose-900/40   text-rose-700   dark:text-rose-300',
    retailer:    'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
    tech:        'bg-slate-100  dark:bg-slate-800      text-slate-600  dark:text-slate-300',
};

function HamburgerMenuC() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, login, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

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
    const roleBadge = ROLE_BADGE_CLASSES[user?.role] ?? ROLE_BADGE_CLASSES.admin;
    const roleLabel = PERSONA_SWATCHES.find(s => s.role === user?.role)?.label ?? user?.role;

    return (
        <>
            {/* Trigger — right side of header */}
            <button
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isOpen}
                aria-controls="hamburger-drawer-c"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <span className="material-symbols-outlined" aria-hidden="true">menu</span>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Navigation menu"
                    id="hamburger-drawer-c"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={close}
                        aria-hidden="true"
                    />

                    {/* Drawer panel — RIGHT side, w-80 */}
                    <div className="relative flex flex-col w-80 h-full bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-200">

                        {/* ── Header (flex-shrink-0) ── */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                            <button
                                onClick={close}
                                aria-label="Close menu"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">AdManager</span>
                                <span className="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">campaign</span>
                            </div>
                        </div>

                        {/* ── Nav links (flex-1, scrollable) — active route highlighted ── */}
                        <nav
                            className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5"
                            aria-label="Main navigation"
                        >
                            {navItems.map(item => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={close}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                            isActive
                                                ? 'bg-primary/10 dark:bg-primary/20 text-primary font-semibold'
                                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span
                                            className={`material-symbols-outlined text-[20px] ${
                                                isActive ? 'text-primary' : 'text-slate-400'
                                            }`}
                                            aria-hidden="true"
                                        >
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* ── Role switcher (flex-shrink-0) — single col, size-3 dots, check on active ── */}
                        <div className="flex-shrink-0 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Switch Demo Role</p>
                            <div className="space-y-1">
                                {PERSONA_SWATCHES.map(swatch => {
                                    const isActive = user?.role === swatch.role;
                                    return (
                                        <button
                                            key={swatch.role}
                                            onClick={() => switchPersona(swatch)}
                                            aria-pressed={isActive}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span className={`size-3 rounded-full flex-shrink-0 ${swatch.color}`} aria-hidden="true" />
                                            <span className="truncate flex-1 text-left">{swatch.label}</span>
                                            {isActive && (
                                                <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">check</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── User footer (flex-shrink-0) — ring avatar, role badge, bordered logout ── */}
                        {user && (
                            <div className="flex-shrink-0 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                                    <div className="size-10 rounded-full bg-primary ring-2 ring-primary/30 flex-shrink-0 flex items-center justify-center text-white font-bold text-base">
                                        {avatarInitial}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0 ${roleBadge}`}>
                                        {roleLabel}
                                    </span>
                                </div>
                                <button
                                    onClick={() => { logout(); close(); navigate('/login'); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-100 dark:border-red-900/30"
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

export default HamburgerMenuC;
