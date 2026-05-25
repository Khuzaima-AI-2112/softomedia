import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const personaSwatchDefs = [
    { label: 'Super Admin', role: 'super_admin', color: 'bg-purple-500' },
    { label: 'Admin',       role: 'admin',       color: 'bg-blue-500'   },
    { label: 'Brand',       role: 'brand',       color: 'bg-rose-500'   },
    { label: 'Retailer',    role: 'retailer',    color: 'bg-amber-500'  },
];

function HamburgerMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, login, logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { label: 'Dashboard', path: '/dashboard/admin', icon: 'dashboard' },
        { label: 'Demo Player', path: '/player/demo', icon: 'slideshow' },
        { label: 'Health', path: '/dashboard/health', icon: 'monitor_heart' },
        ...(user?.role === 'brand' ? [
            { label: 'New Campaign', path: '/dashboard/brand/campaign/new', icon: 'add_circle' }
        ] : []),
        // Settings removed — no /dashboard/settings route exists yet.
        // Add back once the Settings page is built.
    ];

    const personaSwatches = [
        ...personaSwatchDefs,
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
        setIsOpen(false);
        navigate('/dashboard/admin');
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                aria-label="Open menu"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <span className="material-symbols-outlined">menu</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative ml-auto w-72 h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-slate-900 dark:text-white">Menu</span>
                            <button
                                onClick={() => setIsOpen(false)}
                                aria-label="Close menu"
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                            {navItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-slate-400">{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Demo persona switcher */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Switch Demo Role</p>
                            <div className="grid grid-cols-2 gap-2">
                                {personaSwatches.map(swatch => (
                                    <button
                                        key={swatch.role}
                                        onClick={() => switchPersona(swatch)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            user?.role === swatch.role
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className={`size-2.5 rounded-full ${swatch.color}`} />
                                        {swatch.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {user && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                                        {user.name?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { logout(); setIsOpen(false); navigate('/login'); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">logout</span>
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
