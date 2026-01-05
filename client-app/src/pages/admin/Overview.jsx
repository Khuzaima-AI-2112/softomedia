import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import localStorageService from '../../services/LocalStorageService';
import pricingService from '../../services/PricingService';

function AdminOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        retailers: 0,
        advertisers: 0,
        activeScreens: 0,
        totalScreens: 0,
        pendingLoops: 0,
        totalUsers: 0
    });

    const [retailers, setRetailers] = useState([]);
    const [advertisers, setAdvertisers] = useState([]);
    const [showRetailerModal, setShowRetailerModal] = useState(false);
    const [newRetailerName, setNewRetailerName] = useState('');
    const [newRetailerEmail, setNewRetailerEmail] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        localStorageService.init();

        const allRetailers = localStorageService.getRetailers();
        const allAdvertisers = localStorageService.getAdvertisers();
        const allScreens = localStorageService.getScreens();
        const allLoops = localStorageService.getLoops();
        const allUsers = localStorageService.getUsers();

        setRetailers(allRetailers.slice(0, 4));
        setAdvertisers(allAdvertisers.slice(0, 4));

        setStats({
            retailers: allRetailers.length,
            advertisers: allAdvertisers.length,
            activeScreens: allScreens.filter(s => s.status === 'online').length,
            totalScreens: allScreens.length,
            pendingLoops: allLoops.filter(l => l.validationStatus === 'pending').length,
            totalUsers: allUsers.length
        });
    };

    const handleCreateRetailer = () => {
        if (newRetailerName && newRetailerEmail) {
            localStorageService.createRetailer({
                name: newRetailerName,
                contactEmail: newRetailerEmail,
                logo: '🏪'
            });
            loadData();
            setShowRetailerModal(false);
            setNewRetailerName('');
            setNewRetailerEmail('');
        }
    };

    const quickActions = [
        { label: 'CPM Pricing', icon: 'attach_money', path: '/dashboard/admin/pricing', color: 'emerald' },
        { label: 'Users', icon: 'people', path: '/dashboard/admin/users', color: 'blue' },
        { label: 'Retailers', icon: 'storefront', path: '/dashboard/admin/retailers', color: 'amber' },
        { label: 'Advertisers', icon: 'campaign', path: '/dashboard/admin/advertisers', color: 'rose' },
        { label: 'Demo Player', icon: 'slideshow', path: '/player/demo', color: 'purple' },
        { label: 'Network Map', icon: 'map', path: '/dashboard/admin/map', color: 'cyan' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Platform Governance</h1>
                    <p className="text-slate-500 dark:text-slate-400">Softomedia Super Admin Control Center</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowRetailerModal(true)}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        New Retailer
                    </button>
                    <button
                        onClick={() => navigate('/dashboard/admin/map')}
                        className="px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Network Map
                    </button>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickActions.map(action => (
                    <Link
                        key={action.path}
                        to={action.path}
                        className={`
                            p-4 rounded-xl border border-slate-200 dark:border-slate-700 
                            bg-white dark:bg-slate-800/50 hover:border-${action.color}-400 
                            hover:shadow-lg hover:shadow-${action.color}-500/10 transition-all 
                            flex flex-col items-center gap-2 group
                        `}
                    >
                        <div className={`size-10 rounded-lg bg-${action.color}-100 dark:bg-${action.color}-900/30 flex items-center justify-center text-${action.color}-600 dark:text-${action.color}-400 group-hover:scale-110 transition-transform`}>
                            <span className="material-symbols-outlined">{action.icon}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
                    </Link>
                ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Retailers</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.retailers}</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Advertisers</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.advertisers}</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Screens Online</p>
                    <p className="text-3xl font-bold text-emerald-500">{stats.activeScreens}</p>
                    <p className="text-xs text-slate-400">of {stats.totalScreens} total</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Platform Users</p>
                    <p className="text-3xl font-bold text-blue-500">{stats.totalUsers}</p>
                </GlassCard>
            </div>

            {/* Pending Alert */}
            {stats.pendingLoops > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <span className="material-symbols-outlined text-amber-500">pending_actions</span>
                    <div className="flex-1">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                            {stats.pendingLoops} loops awaiting retailer approval
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                            Retailers need to approve tomorrow's schedule
                        </p>
                    </div>
                    <Link
                        to="/dashboard/admin/loops"
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
                    >
                        View Loops
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg">Retail Partners</h3>
                        <Link to="/dashboard/admin/retailers" className="text-primary text-sm font-medium hover:underline">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {retailers.map(ret => {
                            const stores = localStorageService.getStores().filter(s => s.retailerId === ret.id);
                            return (
                                <Link
                                    key={ret.id}
                                    to="/dashboard/admin/retailers"
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-2xl border border-slate-200 dark:border-slate-600">
                                            {ret.logo}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{ret.name}</p>
                                            <p className="text-[11px] text-slate-500">{stores.length} Locations</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={ret.status === 'active' ? 'Active' : 'Inactive'} />
                                </Link>
                            );
                        })}
                    </div>
                </GlassCard>

                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg">Key Advertisers</h3>
                        <Link to="/dashboard/admin/advertisers" className="text-primary text-sm font-medium hover:underline">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {advertisers.map(adv => {
                            const campaigns = localStorageService.getCampaigns().filter(c => c.advertiserId === adv.id);
                            const liveCampaigns = campaigns.filter(c => c.status === 'live').length;
                            return (
                                <Link
                                    key={adv.id}
                                    to="/dashboard/admin/advertisers"
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-amber-500/30 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-2xl border border-slate-200 dark:border-slate-600">
                                            {adv.logo}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">{adv.name}</p>
                                            <p className="text-[11px] text-slate-500">{liveCampaigns} Active Campaigns</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{pricingService.formatPrice(adv.budget)}</p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter font-bold">Budget</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </GlassCard>
            </div>

            {/* New Retailer Modal */}
            {showRetailerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Register New Retailer</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Company Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="e.g. Acme Retail Corp"
                                    value={newRetailerName}
                                    onChange={(e) => setNewRetailerName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contact Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="admin@retailer.com"
                                    value={newRetailerEmail}
                                    onChange={(e) => setNewRetailerEmail(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowRetailerModal(false)}
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateRetailer}
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20"
                                >
                                    Create Account
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}

export default AdminOverview;

