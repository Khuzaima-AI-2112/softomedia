/**
 * Loop Analytics Dashboard
 * Admin interface for monitoring proof-of-play and loop delivery
 * Sprint 5: Analytics & Telemetry
 */

import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import { API_URL } from '../../config';

// Business hours
const BUSINESS_HOURS = { START: 8, END: 22 };

// Format hour
const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

// Generate business hours array
const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) {
        hours.push(h);
    }
    return hours;
};

// 🔶 Mock analytics data (Loop Integrity Model)
const generateMockAnalytics = (date) => {
    const hours = getBusinessHours();
    return hours.map(hour => ({
        hour,
        date,
        // Pivot: Track completions instead of slot plays
        loopCompletions: Math.floor(Math.random() * 20) + 40, // 40-60 loops/hour
        integrityScore: (Math.random() * 5 + 95).toFixed(1), // 95-100%
        status: Math.random() > 0.05 ? 'DELIVERED' : 'PARTIAL'
    }));
};

function LoopAnalytics() {
    const [targetDate, setTargetDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [analytics, setAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedHour, setSelectedHour] = useState(null);

    const businessHours = getBusinessHours();

    useEffect(() => {
        fetchAnalytics();
    }, [targetDate]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // 🔶 TODO: Replace with real API call
            // const res = await fetch(`${API_URL}/api/analytics/loops?date=${targetDate}`);
            // const data = await res.json();

            // Using mock data for now
            const mockData = generateMockAnalytics(targetDate);
            setAnalytics(mockData);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate summary stats
    const totalLoops = analytics.reduce((sum, a) => sum + a.loopCompletions, 0);
    // Average Integrity Score
    const avgIntegrity = analytics.length > 0
        ? (analytics.reduce((sum, a) => sum + parseFloat(a.integrityScore), 0) / analytics.length).toFixed(1)
        : 0;
    const fullDeliveryCount = analytics.filter(a => a.status === 'DELIVERED').length;
    const partialCount = analytics.filter(a => a.status === 'PARTIAL').length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Loop Analytics
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Playlist integrity monitoring and cycle verification
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        data-testid="analytics-date-picker"
                    />
                    <button
                        onClick={fetchAnalytics}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1">Loop Completions</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white" data-testid="total-loops">
                        {totalLoops.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Full cycles verified</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Integrity Score</p>
                    <p className="text-3xl font-bold text-emerald-500" data-testid="avg-integrity-score">
                        {avgIntegrity}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Playlist adherence</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Full Delivery</p>
                    <p className="text-3xl font-bold text-blue-500" data-testid="full-delivery-count">
                        {fullDeliveryCount}/{businessHours.length}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Loops delivered 100%</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Partial Delivery</p>
                    <p className="text-3xl font-bold text-amber-500" data-testid="partial-delivery-count">
                        {partialCount}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Needs attention</p>
                </GlassCard>
            </div>

            {/* Hourly Delivery Chart */}
            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">bar_chart</span>
                        Hourly Delivery Rates
                    </h3>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> &gt;99%
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span> 80-95%
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span> &lt;80%
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-500 animate-pulse">
                        Loading analytics...
                    </div>
                ) : (
                    <div className="space-y-2" data-testid="hourly-chart">
                        {analytics.map(item => {
                            const rate = parseFloat(item.integrityScore);
                            const barColor = rate >= 99 ? 'bg-emerald-500' : rate >= 95 ? 'bg-amber-500' : 'bg-red-500';

                            return (
                                <button
                                    key={item.hour}
                                    onClick={() => setSelectedHour(selectedHour === item.hour ? null : item.hour)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all ${selectedHour === item.hour
                                        ? 'bg-primary/10 border border-primary'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    data-testid={`analytics-hour-${item.hour}`}
                                >
                                    {/* Time */}
                                    <div className="w-20 text-left font-bold text-sm">
                                        {formatHour(item.hour)}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${barColor} transition-all duration-500 flex items-center justify-end pr-3`}
                                            style={{ width: `${item.integrityScore}%` }}
                                        >
                                            <span className="text-white text-xs font-bold">
                                                {item.integrityScore}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="w-24 text-right text-sm">
                                        <span className="font-bold">{item.loopCompletions}</span>
                                        <span className="text-slate-400 ml-1">cycles</span>
                                    </div>

                                    {/* Status */}
                                    <div className="w-20">
                                        <StatusBadge status={item.status === 'DELIVERED' ? 'Active' : 'Warning'} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </GlassCard>

            {/* Slot-Level Detail (when hour selected) */}
            {selectedHour !== null && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">grid_view</span>
                            Slot Details — {formatHour(selectedHour)}
                        </h3>
                        <button
                            onClick={() => setSelectedHour(null)}
                            className="text-sm text-slate-500 hover:text-slate-700"
                        >
                            Close
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="slot-details">
                        {Array.from({ length: 12 }).map((_, i) => {
                            const played = Math.random() > 0.1;
                            const impressions = played ? Math.floor(Math.random() * 50) + 10 : 0;

                            return (
                                <div
                                    key={i}
                                    className={`p-4 rounded-xl border ${played
                                        ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-red-200 bg-red-50 dark:bg-red-900/20'
                                        }`}
                                    data-testid={`slot-detail-${i}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold">Slot {i + 1}</span>
                                        <span className={`text-xs font-bold ${played ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {played ? '✓' : '✗'}
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {impressions}
                                    </div>
                                    <div className="text-xs text-slate-500">impressions</div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            {/* Empty State */}
            {!loading && analytics.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">analytics</span>
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">
                        No Analytics Data
                    </h3>
                    <p className="text-slate-500">
                        No proof-of-play data available for {targetDate}.
                    </p>
                </div>
            )}
        </div>
    );
}

export default LoopAnalytics;
