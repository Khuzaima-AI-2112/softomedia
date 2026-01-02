import React, { useState, useEffect } from 'react';
import GlassCard from './GlassCard.jsx';
import StatusBadge from './StatusBadge.jsx';
import { API_URL } from '../config.js';

/**
 * Super Admin Approval List
 * Filters campaigns pending local retailer approval
 */
const CampaignApprovalList = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/campaigns?status=pending_approval`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCampaigns(data);
            }
        } catch (error) {
            console.error('Fetch pending failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApproval = async (id, status) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/campaigns/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                setCampaigns(prev => prev.filter(c => c.id !== id));
            }
        } catch (error) {
            console.error('Status transition failed:', error);
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Scanning network...</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500">pending_actions</span>
                Requires Attention
            </h3>

            <div className="grid gap-3">
                {campaigns.length > 0 ? campaigns.map(c => (
                    <GlassCard key={c.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-full overflow-hidden border-2 border-white/20">
                                <img src={`https://placehold.co/100x100?text=${encodeURIComponent(c.title)}`} alt={c.title} />
                            </div>
                            <div>
                                <h4 className="font-bold">{c.title}</h4>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">{c.advertiser_id}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleApproval(c.id, 'rejected')}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-all"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => handleApproval(c.id, 'approved')}
                                className="px-4 py-2 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
                            >
                                Approve
                            </button>
                        </div>
                    </GlassCard>
                )) : (
                    <div className="p-12 text-center text-slate-400 border-2 border-dashed rounded-3xl">
                        Clean sweep! No pending approvals.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampaignApprovalList;
