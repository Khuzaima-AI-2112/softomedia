import { useState, useEffect } from 'react';
import GlassCard from './GlassCard.jsx';
import StatusBadge from './StatusBadge.jsx';
import apiService from '../services/ApiService.js';

/**
 * CampaignApprovalList
 * Shows campaigns that are pending retailer approval.
 * - Displays campaign metadata: name, advertiser, date range, budget
 * - Optimistic UI: disables buttons while a status transition is in-flight
 *   to prevent double-click race conditions
 * - Sends lowercase status values ('approved' | 'rejected') to match
 *   the backend normalisation introduced in S8-4
 */
const CampaignApprovalList = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null); // campaign id currently being transitioned

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const data = await apiService.getCampaigns();
            const pending = data.filter(
                c => c.status === 'pending_approval' || c.status === 'PENDING'
            );
            setCampaigns(pending);
        } catch (error) {
            console.error('Fetch pending failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApproval = async (id, status) => {
        // Optimistic lock — prevent double-clicks
        if (processing === id) return;
        setProcessing(id);
        try {
            // Status is already lowercase ('approved' | 'rejected') — matches S8-4 normalisation
            await apiService.updateCampaignStatus(id, status);
            setCampaigns(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Status transition failed:', error);
            alert('Failed to update campaign status. Please try again.');
        } finally {
            setProcessing(null);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const formatBudget = (budget) => {
        if (budget == null) return null;
        return new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0
        }).format(budget);
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Scanning network...</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500">pending_actions</span>
                Requires Attention
                {campaigns.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-semibold">
                        {campaigns.length}
                    </span>
                )}
            </h3>

            <div className="grid gap-3">
                {campaigns.length > 0 ? campaigns.map(c => (
                    <GlassCard key={c.id} className="flex items-center justify-between gap-4 flex-wrap">
                        {/* Thumbnail */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="size-12 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0">
                                <img
                                    src={c.creative_url || `https://placehold.co/100x100?text=${encodeURIComponent(c.name || 'Ad')}`}
                                    alt={c.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Campaign metadata */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold truncate">{c.name}</h4>
                                    <StatusBadge status={c.status} />
                                </div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider truncate">
                                    {c.advertiser_id}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {formatDate(c.start_date)} → {formatDate(c.end_date)}
                                    {c.budget != null && (
                                        <span className="ml-2 font-medium text-slate-500">
                                            · {formatBudget(c.budget)}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => handleApproval(c.id, 'rejected')}
                                disabled={processing === c.id}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {processing === c.id ? '...' : 'Reject'}
                            </button>
                            <button
                                onClick={() => handleApproval(c.id, 'approved')}
                                disabled={processing === c.id}
                                className="px-4 py-2 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {processing === c.id ? '...' : 'Approve'}
                            </button>
                        </div>
                    </GlassCard>
                )) : (
                    <div className="p-12 text-center text-slate-400 border-2 border-dashed rounded-3xl">
                        <span className="material-symbols-outlined text-4xl mb-2 block text-slate-300">check_circle</span>
                        Clean sweep! No pending approvals.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampaignApprovalList;
