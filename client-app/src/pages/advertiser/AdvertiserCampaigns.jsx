import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../services/ApiService';
import CampaignWizardModal from '../../components/CampaignWizardModal';

/**
 * AdvertiserCampaigns — S14-3
 * Full campaign list for the advertiser persona.
 * Shows all campaigns scoped by the back end to the caller's linked_entity_id.
 * Supports client-side filter by status.
 *
 * S22-1: replaced /campaigns/new <Link> with CampaignWizardModal trigger.
 * Modal sources retailers from getRetailersForCampaign() (S21-5, ?for=campaign).
 */

const STATUS_CONFIG = [
    { key: '',                 label: 'All'       },
    { key: 'pending_approval', label: 'Pending'   },
    { key: 'approved',         label: 'Approved'  },
    { key: 'live',             label: 'Live'      },
    { key: 'paused',           label: 'Paused'    },
    { key: 'completed',        label: 'Completed' },
    { key: 'rejected',         label: 'Rejected'  },
];

const STATUS_COLOUR = {
    pending_approval: 'bg-yellow-100 text-yellow-800  dark:bg-yellow-900/30 dark:text-yellow-300',
    approved:         'bg-blue-100   text-blue-800    dark:bg-blue-900/30   dark:text-blue-300',
    live:             'bg-green-100  text-green-800   dark:bg-green-900/30  dark:text-green-300',
    paused:           'bg-slate-100  text-slate-700   dark:bg-slate-800     dark:text-slate-300',
    completed:        'bg-purple-100 text-purple-800  dark:bg-purple-900/30 dark:text-purple-300',
    rejected:         'bg-red-100    text-red-800     dark:bg-red-900/30    dark:text-red-300',
};

export default function AdvertiserCampaigns() {
    const [campaigns, setCampaigns]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [statusFilter, setFilter]     = useState('');
    const [showWizard, setShowWizard]   = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        const params = statusFilter ? { status: statusFilter } : {};
        apiService.getCampaigns(params)
            .then(res => setCampaigns(res.data ?? res))
            .catch(err => setError(err?.response?.data?.error ?? err.message))
            .finally(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    // Called by CampaignWizardModal on successful 201 — optimistic refetch.
    const handleCampaignCreated = useCallback(() => {
        setShowWizard(false);
        load();
    }, [load]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Campaigns</h1>
                <button
                    onClick={() => setShowWizard(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                    New Campaign
                </button>
            </div>

            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
                {STATUS_CONFIG.map(({ key, label }) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={statusFilter === key}
                        onClick={() => setFilter(key)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                            statusFilter === key
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {loading ? (
                <div className="space-y-2">
                    {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            ) : campaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 flex flex-col items-center text-center gap-3">
                    <span className="material-symbols-outlined text-[48px] text-slate-400" aria-hidden="true">search_off</span>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {statusFilter ? `No ${statusFilter.replace('_', ' ')} campaigns` : 'No campaigns yet'}
                    </p>
                    {!statusFilter && (
                        <button
                            onClick={() => setShowWizard(true)}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
                            Create Campaign
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                {['Name', 'Retailer', 'Status', 'Budget', 'Start', 'End', 'Created'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {campaigns.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                        {c.name ?? c.id}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                        {c.retailer_name ?? c.retailer_id ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            STATUS_COLOUR[c.status] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                            {c.status ?? 'unknown'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                        {c.budget ? `$${Number(c.budget).toLocaleString()}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                        {c.start_date ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                        {c.end_date ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CampaignWizard creation modal — S22-1 */}
            {showWizard && (
                <CampaignWizardModal
                    onSuccess={handleCampaignCreated}
                    onClose={() => setShowWizard(false)}
                />
            )}
        </div>
    );
}
