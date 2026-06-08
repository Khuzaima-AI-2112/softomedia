import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/ApiService';

/**
 * AdvertiserDashboard — S14-3
 * Landing page for the advertiser persona.
 * Shows a summary of the advertiser's own campaigns grouped by status.
 */
export default function AdvertiserDashboard() {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);

    useEffect(() => {
        apiService.getCampaigns()
            .then(res => setCampaigns(res.data ?? res))
            .catch(err => setError(err?.response?.data?.error ?? err.message))
            .finally(() => setLoading(false));
    }, []);

    const byStatus = campaigns.reduce((acc, c) => {
        const s = c.status ?? 'unknown';
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
    }, {});

    const STATUS_CONFIG = [
        { key: 'pending_approval', label: 'Pending',   colour: 'bg-yellow-100 text-yellow-800  dark:bg-yellow-900/30 dark:text-yellow-300'  },
        { key: 'approved',         label: 'Approved',  colour: 'bg-blue-100   text-blue-800    dark:bg-blue-900/30   dark:text-blue-300'    },
        { key: 'live',             label: 'Live',      colour: 'bg-green-100  text-green-800   dark:bg-green-900/30  dark:text-green-300'   },
        { key: 'paused',           label: 'Paused',    colour: 'bg-slate-100  text-slate-700   dark:bg-slate-800     dark:text-slate-300'   },
        { key: 'completed',        label: 'Completed', colour: 'bg-purple-100 text-purple-800  dark:bg-purple-900/30 dark:text-purple-300'  },
        { key: 'rejected',         label: 'Rejected',  colour: 'bg-red-100    text-red-800     dark:bg-red-900/30    dark:text-red-300'     },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Welcome back{user?.name ? `, ${user.name}` : ''}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Advertiser Portal — campaign overview
                    </p>
                </div>
                <Link
                    to="/dashboard/advertiser/campaigns/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                    New Campaign
                </Link>
            </div>

            {/* Status summary cards */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {STATUS_CONFIG.map(s => (
                        <div key={s.key} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            ) : error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {STATUS_CONFIG.map(({ key, label, colour }) => (
                        <div
                            key={key}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-1 shadow-sm"
                        >
                            <span className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold ${colour}`}>
                                {label}
                            </span>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                                {byStatus[key] ?? 0}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent campaigns table */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Recent Campaigns</h2>
                    <Link
                        to="/dashboard/advertiser/campaigns"
                        className="text-sm text-primary hover:underline"
                    >
                        View all
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 flex flex-col items-center text-center gap-3">
                        <span className="material-symbols-outlined text-[40px] text-slate-400" aria-hidden="true">campaign</span>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No campaigns yet</p>
                        <p className="text-xs text-slate-400">Create your first campaign to get started.</p>
                        <Link
                            to="/dashboard/advertiser/campaigns/new"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
                            Create Campaign
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    {['Name', 'Status', 'Created', 'Play Count'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {campaigns.slice(0, 10).map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                            <Link to={`/dashboard/advertiser/campaigns`} className="hover:underline">
                                                {c.name ?? c.id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                STATUS_CONFIG.find(s => s.key === c.status)?.colour ??
                                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            }`}>
                                                {c.status ?? 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                            {c.play_count ?? 0}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
