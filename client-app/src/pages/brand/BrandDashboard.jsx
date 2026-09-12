import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import KPICard from '../../components/KPICard';
import DataTable from '../../components/DataTable';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';
import pricingService from '../../services/PricingService';

const BrandDashboard = () => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        active: 0,
        screens: 0,
        impressions: 0,
        spent: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // Get campaigns for this advertiser (demo: use ALL for now, or filter if backend supports it)
            const [allCampaigns, inventory] = await Promise.all([
                apiService.getCampaigns(),
                apiService.getBookableInventory()
            ]);

            pricingService.configureBookableInventory(inventory.items);
            const campaignsWithProofs = await Promise.all(allCampaigns.map(async campaign => ({
                ...campaign,
                proofs_of_play: await apiService.getCampaignProofsOfPlay(campaign.id),
            })));
            setCampaigns(campaignsWithProofs);

            // Calculate stats (case-insensitive for robustness)
            const liveCampaigns = campaignsWithProofs.filter(c => c.status?.toLowerCase() === 'live');
            const totalSpent = campaignsWithProofs.reduce((sum, c) => sum + (c.spent || 0), 0);
            const totalImpressions = campaignsWithProofs.reduce((sum, c) => sum + c.proofs_of_play.length, 0);
            const availableScreens = inventory.items.filter(item => item.availability.bookable).length;

            setStats({
                active: liveCampaigns.length,
                screens: availableScreens,
                impressions: totalImpressions,
                spent: totalSpent
            });
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const kpis = [
        { label: 'Active Campaigns', value: String(stats.active), trend: '+1', icon: 'campaign', color: 'text-primary' },
        { label: 'Screens Available', value: String(stats.screens), trend: '+5', icon: 'tv', color: 'text-blue-400' },
        { label: 'Total Spent', value: pricingService.formatPrice(stats.spent), trend: '+12%', icon: 'payments', color: 'text-emerald-400' },
    ];

    const columns = [
        {
            header: 'Campaign Name',
            render: (cmp) => (
                <div className="flex flex-col">
                    <span className="text-base font-semibold">{cmp.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ID: {cmp.id}</span>
                </div>
            )
        },
        {
            header: 'Preview',
            render: (cmp) => (
                <div className="relative w-16 h-10 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-700">
                    <img
                        className="absolute inset-0 size-full object-cover"
                        src={cmp.creative_url}
                        alt={`${cmp.name} creative`}
                    />
                </div>
            )
        },
        {
            header: 'Status',
            render: (cmp) => (
                <span data-testid="campaign-status" className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cmp.status === 'live' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                    cmp.status === 'scheduled' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                        cmp.status === 'pending_approval' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                    {cmp.status === 'live' && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                    {cmp.status === 'live' ? 'Live' : cmp.status === 'scheduled' ? 'Scheduled' : cmp.status === 'pending_approval' ? 'Pending' : cmp.status === 'approved' ? 'Approved' : cmp.status === 'rejected' ? 'Rejected' : cmp.status === 'completed' ? 'Completed' : cmp.status}
                </span>
            )
        },
        {
            header: 'Placement',
            render: (cmp) => (
                <span className="text-sm font-medium">
                    {(cmp.inventory_selection || []).map(item => item.screen_id).join(', ') || 'Pending'}
                </span>
            )
        },
        {
            header: 'Proof of Play',
            render: (cmp) => (
                <span className="text-sm font-medium">
                    {cmp.proofs_of_play?.length || 0} Proofs of Play
                </span>
            )
        },
        {
            header: 'Duration',
            render: (cmp) => (
                <span className="text-sm">
                    {new Date(cmp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(cmp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
            )
        },
        {
            header: 'Budget',
            render: (cmp) => (
                <div className="flex flex-col">
                    <span className="font-medium">{pricingService.formatPrice(cmp.budget)}</span>
                    <span className="text-xs text-slate-500">
                        {pricingService.formatPrice(cmp.spent || 0)} spent
                    </span>
                </div>
            )
        },
        {
            header: 'Performance',
            render: (cmp) => {
                const progress = cmp.budget > 0 ? Math.round(((cmp.spent || 0) / cmp.budget) * 100) : 0;
                return (
                    <div className="flex flex-col gap-1 w-24">
                        <span className="text-slate-900 dark:text-white font-medium">
                            {pricingService.formatImpressions(cmp.impressions || 0)}
                            <span className="text-xs font-normal text-slate-500"> Impr.</span>
                        </span>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <div
                                className={`h-1.5 rounded-full ${cmp.status === 'ended' ? 'bg-slate-400' : 'bg-primary'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Actions',
            className: 'text-right',
            render: () => (
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Edit">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Pause">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">pause_circle</span>
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Settings">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">more_vert</span>
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Your Campaigns</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage and monitor your advertising campaigns</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/player/demo"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">slideshow</span>
                        Preview Demo
                    </Link>
                    <button
                        onClick={() => navigate('campaign/new')}
                        data-testid="new-campaign-btn"
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg text-sm px-5 py-2.5 transition-colors shadow-lg shadow-primary/25"
                    >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
                        <span>New Campaign</span>
                    </button>
                </div>
            </div>

            {/* KPI Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kpis.map((kpi, i) => (
                    <KPICard
                        key={i}
                        label={kpi.label}
                        value={kpi.value}
                        trend={kpi.trend}
                        icon={kpi.icon}
                        color={kpi.color}
                        description="Running across network"
                    />
                ))}
            </div>

            {/* Quick Tip for new users */}
            {campaigns.length === 0 && (
                <GlassCard className="border-l-4 border-l-primary">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-2xl">lightbulb</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold">Ready to advertise?</p>
                            <p className="text-sm text-slate-500">Create your first campaign to start reaching customers across our retail network.</p>
                        </div>
                        <button
                            onClick={() => navigate('campaign/new')}
                            className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover"
                        >
                            Get Started
                        </button>
                    </div>
                </GlassCard>
            )}

            {/* Main Table */}
            {campaigns.length > 0 && (
                <DataTable
                    columns={columns}
                    data={campaigns}
                />
            )}
        </div>
    );
};

export default BrandDashboard;

