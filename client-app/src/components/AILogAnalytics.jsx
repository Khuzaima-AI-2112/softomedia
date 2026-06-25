import { useState, useEffect } from 'react';
import GlassCard from './GlassCard';
import { API_URL } from '../config';

function AILogAnalytics() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    useEffect(() => {
        loadStats();
    }, [days]);

    const loadStats = async () => {
        try {
            setLoading(true);
            // eslint-disable-next-line no-restricted-syntax
            const response = await fetch(`${API_URL}/ghost-api/admin/stats?days=${days}`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to load AI stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <GlassCard className="p-6">
                <div className="flex items-center justify-center py-8">
                    <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
                </div>
            </GlassCard>
        );
    }

    if (!stats) {
        return (
            <GlassCard className="p-6">
                <div className="text-center py-8 text-slate-500">Failed to load analytics</div>
            </GlassCard>
        );
    }

    // Calculate max values for scaling
    const maxDailyCount = Math.max(...stats.dailyUsage.map(d => d.count), 1);
    const maxDailyCost = Math.max(...stats.dailyUsage.map(d => d.cost), 0.001);
    const maxRatingCount = Math.max(...Object.values(stats.ratingDistribution), 1);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Summary Stats */}
            <GlassCard className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">summarize</span>
                    Summary ({days} days)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalConversations}</p>
                        <p className="text-xs text-slate-500">Total Queries</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-2xl font-bold text-primary">${stats.totalCost.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">Total Cost</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-2xl font-bold text-amber-500">{stats.averageRating || 'N/A'}</p>
                        <p className="text-xs text-slate-500">Avg Rating</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{(stats.totalTokens / 1000).toFixed(1)}k</p>
                        <p className="text-xs text-slate-500">Total Tokens</p>
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1 text-xs rounded-full ${
                                days === d
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                        >
                            {d} days
                        </button>
                    ))}
                </div>
            </GlassCard>

            {/* Rating Distribution */}
            <GlassCard className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400">star</span>
                    Rating Distribution
                </h3>
                <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map(rating => {
                        const count = stats.ratingDistribution[rating] || 0;
                        const percentage = maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0;
                        return (
                            <div key={rating} className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5 w-20">
                                    {[...Array(rating)].map((_, i) => (
                                        <span
                                            key={i}
                                            className="material-symbols-outlined text-xs text-amber-400"
                                            style={{ fontVariationSettings: "'FILL' 1" }}
                                        >
                                            star
                                        </span>
                                    ))}
                                </div>
                                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 text-xs text-slate-400 text-center">
                    {stats.ratingsCount} total ratings
                </div>
            </GlassCard>

            {/* Usage Over Time */}
            <GlassCard className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">trending_up</span>
                    Daily Usage
                </h3>
                <div className="h-32 flex items-end gap-1">
                    {stats.dailyUsage.slice(-14).map((day, idx) => {
                        const heightPercent = (day.count / maxDailyCount) * 100;
                        return (
                            <div
                                key={day.date}
                                className="flex-1 group relative"
                            >
                                <div
                                    className="bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-300 hover:bg-blue-600"
                                    style={{ height: `${Math.max(heightPercent, 2)}%` }}
                                ></div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                        {day.date}: {day.count} queries
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                    <span>{stats.dailyUsage[Math.max(0, stats.dailyUsage.length - 14)]?.date || ''}</span>
                    <span>{stats.dailyUsage[stats.dailyUsage.length - 1]?.date || ''}</span>
                </div>
            </GlassCard>

            {/* Cost Over Time */}
            <GlassCard className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500">payments</span>
                    Daily Cost
                </h3>
                <div className="h-32 flex items-end gap-1">
                    {stats.dailyUsage.slice(-14).map((day, idx) => {
                        const heightPercent = (day.cost / maxDailyCost) * 100;
                        return (
                            <div
                                key={day.date}
                                className="flex-1 group relative"
                            >
                                <div
                                    className="bg-green-500 dark:bg-green-400 rounded-t transition-all duration-300 hover:bg-green-600"
                                    style={{ height: `${Math.max(heightPercent, 2)}%` }}
                                ></div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                        {day.date}: ${day.cost.toFixed(4)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                    <span>{stats.dailyUsage[Math.max(0, stats.dailyUsage.length - 14)]?.date || ''}</span>
                    <span>{stats.dailyUsage[stats.dailyUsage.length - 1]?.date || ''}</span>
                </div>
            </GlassCard>

            {/* Persona Distribution */}
            <GlassCard className="p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500">people</span>
                    Usage by Persona
                </h3>
                <div className="flex gap-4">
                    {Object.entries(stats.personaDistribution).map(([persona, count]) => {
                        const percentage = stats.totalConversations > 0
                            ? ((count / stats.totalConversations) * 100).toFixed(1)
                            : 0;
                        const isBuyer = persona === 'CRM_buyer_persona';
                        return (
                            <div key={persona} className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        isBuyer
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    }`}>
                                        {isBuyer ? 'Buyer' : 'Tester'}
                                    </span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{count} ({percentage}%)</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            isBuyer ? 'bg-blue-500' : 'bg-purple-500'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </GlassCard>
        </div>
    );
}

export default AILogAnalytics;
