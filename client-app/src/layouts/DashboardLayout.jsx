import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import PersonaSwitcher from '../components/PersonaSwitcher';
import { useAuth } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';

function DashboardLayout() {
    const { persona, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Role-based routing: Ensure the URL matches the persona
    React.useEffect(() => {
        if (!loading && persona && location.pathname === '/dashboard') {
            // Default landing redirect
            navigate(`/dashboard/${persona}`, { replace: true });
        }
    }, [persona, loading, location.pathname, navigate]);

    if (loading) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white relative">
            <HamburgerMenu />

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
                    <div className="size-10 rounded-full bg-slate-200 bg-center bg-cover border-2 border-primary/20"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDIf29faZUdAOHSrg73fRjKadBDM-5EF4bdvDm-PKmuZoalok9AQizOwZuVz5uBc4NbonpQN_sNa7vx4QBd9jrnL0ypn9aE8vWXv2HMxhcYKBQ9LcU8KHbn8HuP8uBNIAH3Pni-9WiJbvI1eyOIfEcdBJg3tpNx83COxh59IADm3lfD3Fe50jUVrtQ_Qnuhlbsrl1FNX0A04o61JShF8tGClqhrGqQQxeJYVxsl5Sf6FQAV1Wc10SAg9W5j_cdaGPa4OgeHezI4MA")' }}>
                    </div>
                </div>
            </header>

            <main className="p-4 lg:p-10 max-w-[1440px] mx-auto">
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>
        </div>
    );
}

export default DashboardLayout;
