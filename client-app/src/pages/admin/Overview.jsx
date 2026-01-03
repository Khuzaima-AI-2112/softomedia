import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import { API_URL } from '../../config';

function AdminOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        retailers: 0,
        advertisers: 0,
        activeScreens: 0
    });

    const [retailers, setRetailers] = useState([]);
    const [advertisers, setAdvertisers] = useState([]);
    const [showRetailerModal, setShowRetailerModal] = useState(false);
    const [newRetailerName, setNewRetailerName] = useState('');

    useEffect(() => {
        // In physical MVP, these would be fetch calls to the new repositories
        // Mocking for immediate UI feedback
        setStats({
            retailers: 12,
            advertisers: 45,
            activeScreens: 1240
        });

        setRetailers([
            { id: 'ret_001', name: 'Demo Retail Corp', locations: 5, status: 'Active' },
            { id: 'ret_002', name: 'Metro Markets', locations: 12, status: 'Active' },
            { id: 'ret_003', name: 'Fresh Stop', locations: 3, status: 'Warning' },
        ]);

        setAdvertisers([
            { id: 'adv_001', name: 'Global Brands Inc', campaigns: 8, budget: '$12k' },
            { id: 'adv_002', name: 'Tech Solutions', campaigns: 3, budget: '$5k' },
        ]);
    }, []);

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Registered Retailers</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{stats.retailers}</p>
                        <span className="text-xs font-bold text-emerald-500 flex items-center">+2 this month</span>
                    </div>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Active Advertisers</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{stats.advertisers}</p>
                        <span className="text-xs font-bold text-emerald-500 flex items-center">+5 this month</span>
                    </div>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1 leading-none">Network Health</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none">98.4%</p>
                        <span className="text-xs font-bold text-emerald-500 flex items-center">Stable</span>
                    </div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg">Retail Partners</h3>
                        <button className="text-primary text-sm font-medium hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                        {retailers.map(ret => (
                            <div key={ret.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-primary font-bold border border-slate-200 dark:border-slate-600">
                                        {ret.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{ret.name}</p>
                                        <p className="text-[11px] text-slate-500 capitalize">{ret.locations} Locations</p>
                                    </div>
                                </div>
                                <StatusBadge status={ret.status} />
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg">Key Advertisers</h3>
                        <button className="text-primary text-sm font-medium hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                        {advertisers.map(adv => (
                            <div key={adv.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-amber-500/30 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-amber-500 font-bold border border-slate-200 dark:border-slate-600">
                                        {adv.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">{adv.name}</p>
                                        <p className="text-[11px] text-slate-500 capitalize">{adv.campaigns} Active Campaigns</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{adv.budget}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter font-bold">MoM Spend</p>
                                </div>
                            </div>
                        ))}
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
                                    placeholder="e.g. Acme Corp"
                                    value={newRetailerName}
                                    onChange={(e) => setNewRetailerName(e.target.value)}
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
                                    onClick={() => {
                                        // Mock add
                                        if (newRetailerName) {
                                            setRetailers([...retailers, { id: `ret_${Date.now()}`, name: newRetailerName, locations: 1, status: 'Active' }]);
                                            setShowRetailerModal(false);
                                            setNewRetailerName('');
                                        }
                                    }}
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
