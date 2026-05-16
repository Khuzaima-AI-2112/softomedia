import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import SupportTicketModal from '../../components/SupportTicketModal';
import LocationManager from '../../components/LocationManager';
import CampaignApprovalList from '../../components/CampaignApprovalList';
import apiService from '../../services/ApiService';

function RetailerDashboard() {
    const [isSyncActive, setIsSyncActive] = useState(true);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        stores: 0,
        screens: 0,
        onlineScreens: 0,
        pendingLoops: 0
    });

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const [stores, screens, loops] = await Promise.all([
                apiService.getStores(),
                apiService.getScreens(),
                apiService.getLoops()
            ]);

            setStats({
                stores: stores.length,
                screens: screens.length,
                onlineScreens: screens.filter(s => s.status === 'online' || s.status === 'ACTIVE').length,
                pendingLoops: loops.filter(l => l.validation_status === 'pending' || l.status === 'PENDING').length
            });
        } catch (error) {
            console.error('Failed to load retailer stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSync = () => setIsSyncActive(!isSyncActive);

    const quickActions = [
        { label: 'Schedule Calendar', icon: 'event', path: '/dashboard/retailer/schedule/calendar', color: 'primary' },
        { label: 'Approval History', icon: 'history', path: '/dashboard/retailer/history', color: 'amber' },
        { label: 'Demo Player', icon: 'slideshow', path: '/player/demo', color: 'purple' }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Retailer Command Center</h1>
                    <p className="text-slate-500 dark:text-slate-400">Network health and store management for your locations</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
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
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : stats.stores}</p>
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
                    <p className="text-sm text-slate-500 mb-1">Pending Approvals</p>
                    <p className={`text-2xl font-bold ${stats.pendingLoops > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {loading ? '...' : stats.pendingLoops}
                    </p>
                </GlassCard>
            </div>

            {/* Pending Alert */}
            {!loading && stats.pendingLoops > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <span className="material-symbols-outlined text-amber-500">pending_actions</span>
                    <div className="flex-1">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                            {stats.pendingLoops} loops awaiting your approval
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                            Review tomorrow&apos;s broadcast schedule before midnight
                        </p>
                    </div>
                    <Link
                        to="/dashboard/retailer/schedule/calendar"
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
                    >
                        Review Now
                    </Link>
                </div>
            )}

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

            <CampaignApprovalList />

            <LocationManager />

            {isSupportModalOpen && <SupportTicketModal onClose={() => setIsSupportModalOpen(false)} />}
        </div>
    );
}

export default RetailerDashboard;

