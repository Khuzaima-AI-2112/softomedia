import React, { useState } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import SupportTicketModal from '../../components/SupportTicketModal';
import LocationManager from '../../components/LocationManager';
import CampaignApprovalList from '../../components/CampaignApprovalList';

function RetailerDashboard() {
    const [isSyncActive, setIsSyncActive] = useState(true);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

    const toggleSync = () => setIsSyncActive(!isSyncActive);

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
                        className={`flex-1 md:flex-none px-4 py-2 text-white border-none rounded-lg font-bold transition-all ${isSyncActive ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20'}`}
                    >
                        {isSyncActive ? 'Disconnect Sync' : 'Re-establish Sync'}
                    </button>
                </div>
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

            <CampaignApprovalList />

            <LocationManager />

            {isSupportModalOpen && <SupportTicketModal onClose={() => setIsSupportModalOpen(false)} />}
        </div>
    );
}

export default RetailerDashboard;
