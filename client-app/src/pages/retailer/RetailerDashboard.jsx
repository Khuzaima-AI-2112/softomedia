import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import SupportTicketModal from '../../components/SupportTicketModal';
import LocationManager from '../../components/LocationManager';
import apiService from '../../services/ApiService';

/**
 * RetailerDashboard
 *
 * Sprint 9 — Task 9.4: Fix two dead quick-action links.
 *   Before: '/dashboard/retailer/schedule/calendar'  → 404 (no such route in App.jsx)
 *   After:  '/dashboard/retailer/schedule'           → ScheduleCalendar (App.jsx line confirmed)
 *
 * Nobody approves an Hourly Loop (ADR 0007), so there is no pending-approval count.
 */
function RetailerDashboard() {
    const [isSyncActive, setIsSyncActive] = useState(true);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    const [supportNotice, setSupportNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        stores: 0,
        screens: 0,
        onlineScreens: 0
    });

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const [stores, screens] = await Promise.all([
                apiService.getStores(),
                apiService.getScreens()
            ]);

            setStats({
                stores: stores.length,
                screens: screens.length,
                onlineScreens: screens.filter(s => s.status === 'online' || s.status === 'ACTIVE').length
            });
        } catch (error) {
            console.error('Failed to load retailer stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSync = () => setIsSyncActive(!isSyncActive);

    // S9-4: paths corrected to match registered routes in App.jsx
    const quickActions = [
        { label: 'Schedule Calendar', icon: 'event', path: '/dashboard/retailer/schedule', color: 'primary' },
    ];

    return (
        <div data-testid="retailer-dashboard-kpis" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Retailer Command Center</h1>
                    <p className="text-slate-500 dark:text-slate-400">Network health and store management for your locations</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        data-testid="btn-create-ticket"
                        onClick={() => setIsSupportModalOpen(true)}
                        className="flex-1 md:flex-none px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Report Issue
                    </button>
                    <button
                        onClick={toggleSync}
                        className={`flex-1 md:flex-none px-4 py-2 text-white border-none rounded-lg font-bold transition-all ${isSyncActive ? 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20' : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20'}`}
                    >
                        {isSyncActive ? 'Disconnect Sync' : 'Re-establish Sync'}
                    </button>
                </div>
            </div>

            {supportNotice && (
                <p role="status" className="text-sm text-emerald-700">
                    {supportNotice} <Link to="/dashboard/tickets" className="underline">View Support Tickets</Link>
                </p>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map(action => (
                    <Link
                        key={action.path}
                        to={action.path}
                        className={`
                            p-4 rounded-xl border border-slate-200 dark:border-slate-700 
                            bg-white dark:bg-slate-800/50 hover:border-primary/50
                            hover:shadow-lg transition-all flex items-center gap-3 group
                        `}
                    >
                        <div className={`size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform`}>
                            <span className="material-symbols-outlined">{action.icon}</span>
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
                    </Link>
                ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="!p-4">
                    <p className="text-sm text-slate-500 mb-1">Stores</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {loading ? <span data-testid="kpi-loading">...</span> : stats.stores}
                    </p>
                </GlassCard>
                <GlassCard className="!p-4">
                    <p className="text-sm text-slate-500 mb-1">Screens</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : stats.screens}</p>
                </GlassCard>
                <GlassCard className="!p-4">
                    <p className="text-sm text-slate-500 mb-1">Online</p>
                    <p className="text-2xl font-bold text-emerald-500">{loading ? '...' : stats.onlineScreens}</p>
                </GlassCard>
                <GlassCard className="!p-4">
                    <p className="text-sm text-slate-500 mb-1">Available Hours</p>
                    <p data-testid="kpi-available-hours" className="text-2xl font-bold text-blue-500">
                        {loading ? '...' : '168'}
                    </p>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassCard className="flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">hub</span>
                            Network Connectivity
                        </span>
                        <StatusBadge status={isSyncActive ? 'Online' : 'Offline'} />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isSyncActive ? 'Secure handshake active with Softomedia-Cloud core' : 'Connection lost. Please check local connectivity.'}
                    </p>
                </GlassCard>
                <GlassCard className="flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">cyclone</span>
                            Active Loop Rate
                        </span>
                        <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">12 Slots/Min</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Fixed 5-second per ad transition with D-1 scheduling sync.</p>
                </GlassCard>
            </div>

            <LocationManager />

            {isSupportModalOpen && (
                <SupportTicketModal
                    onClose={() => setIsSupportModalOpen(false)}
                    onTicketCreated={() => {
                        setIsSupportModalOpen(false);
                        setSupportNotice('Support Ticket submitted.');
                    }}
                />
            )}
        </div>
    );
}

export default RetailerDashboard;
