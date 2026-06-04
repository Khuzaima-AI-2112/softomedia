/**
 * Loop Analytics Dashboard
 * Admin / internal ops interface for monitoring loop delivery and integrity.
 * Sprint 5: Analytics & Telemetry
 */

import { useState, useEffect, useCallback } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiClient from '../../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const BUSINESS_HOURS = { START: 8, END: 22 };

const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) hours.push(h);
    return hours;
};

// Return an array of ISO date strings for the last N days (today first)
const getLastNDates = (n) => {
    const dates = [];
    for (let i = 0; i < n; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
};

const todayISO = () => new Date().toISOString().split('T')[0];

// ── CSV export helper ─────────────────────────────────────────────────────────
const escapeCSV = (val) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
};

const exportToCSV = (rows, filename) => {
    const header = ['Time', 'Loop Completions', 'Integrity Score', 'Slot Failures', 'Status'];
    const lines = [
        header.join(','),
        ...rows.map(r =>
            [
                escapeCSV(r.label),
                escapeCSV(r.loopCompletions),
                escapeCSV(r.integrityScore),
                escapeCSV(r.slotFailures ?? 0),
                escapeCSV(r.status),
            ].join(',')
        ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

// ── Component ─────────────────────────────────────────────────────────────────
function LoopAnalytics() {
    const [targetDate, setTargetDate] = useState(todayISO);
    // 'week' = 7-day aggregate view, 'day' = single-day hourly view
    const [viewMode, setViewMode] = useState('week');
    const [weekRows, setWeekRows] = useState([]);
    const [dayRows, setDayRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiUnavailable, setApiUnavailable] = useState(false);
    const [selectedHour, setSelectedHour] = useState(null);

    const businessHours = getBusinessHours();

    // ── Fetch single-day hourly data ──────────────────────────────────────────
    const fetchDay = useCallback(async (date) => {
        const data = await apiClient.get(`/api/analytics/loops?date=${date}`);
        return Array.isArray(data) ? data : [];
    }, []);

    // ── Fetch 7-day aggregate via Promise.allSettled ──────────────────────────
    const fetchWeek = useCallback(async () => {
        const dates = getLastNDates(7);
        const results = await Promise.allSettled(dates.map(d => fetchDay(d)));
        return dates.map((date, i) => {
            if (results[i].status === 'rejected' || !results[i].value?.length) {
                return { label: date, loopCompletions: null, integrityScore: null, slotFailures: null, status: 'UNAVAILABLE' };
            }
            const rows = results[i].value;
            const totalLoops = rows.reduce((s, r) => s + (r.loopCompletions ?? 0), 0);
            const avgIntegrity = (rows.reduce((s, r) => s + parseFloat(r.integrityScore ?? 0), 0) / rows.length).toFixed(1);
            const slotFailures = rows.filter(r => r.status === 'PARTIAL').length;
            const status = slotFailures === 0 ? 'DELIVERED' : 'PARTIAL';
            return { label: date, loopCompletions: totalLoops, integrityScore: avgIntegrity, slotFailures, status };
        });
    }, [fetchDay]);

    // ── Load on mount and when date changes ──────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiUnavailable(false);
            try {
                const [week, day] = await Promise.all([
                    fetchWeek(),
                    fetchDay(targetDate),
                ]);
                if (!cancelled) {
                    setWeekRows(week);
                    setDayRows(day.map(r => ({ ...r, label: formatHour(r.hour) })));
                }
            } catch {
                if (!cancelled) setApiUnavailable(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [targetDate, fetchWeek, fetchDay]);

    // Re-fetch day only when date picker changes (week re-fetches too via useEffect dep)
    const handleDateChange = (e) => {
        setTargetDate(e.target.value);
        setViewMode('day');
        setSelectedHour(null);
    };

    const handleRefresh = () => {
        setTargetDate(t => t); // trigger useEffect by forcing re-render via state flush
        setWeekRows([]);
        setDayRows([]);
        setSelectedHour(null);
    };

    // ── Active table rows ─────────────────────────────────────────────────────
    const activeRows = viewMode === 'week' ? weekRows : dayRows;

    // ── KPI aggregates (from active view) ────────────────────────────────────
    const validRows = activeRows.filter(r => r.loopCompletions !== null);
    const totalLoops = validRows.reduce((s, r) => s + (r.loopCompletions ?? 0), 0);
    const avgIntegrity = validRows.length
        ? (validRows.reduce((s, r) => s + parseFloat(r.integrityScore ?? 0), 0) / validRows.length).toFixed(1)
        : '—';
    const slotFailures = validRows.filter(r => r.status === 'PARTIAL').length;
    const fullDelivery = validRows.filter(r => r.status === 'DELIVERED').length;

    // ── CSV export ────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        exportToCSV(activeRows, `loop-analytics-${targetDate}.csv`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Loop Analytics
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Internal delivery monitoring for loop completion and integrity
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={targetDate}
                        onChange={handleDateChange}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        data-testid="analytics-date-picker"
                    />
                    <button
                        onClick={() => { setViewMode('week'); setSelectedHour(null); }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        7-day
                    </button>
                    <button
                        onClick={() => { setViewMode('day'); setSelectedHour(null); }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'day' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        Day
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={!activeRows.length || loading}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        data-testid="export-csv-btn"
                    >
                        <span className="material-symbols-outlined text-[20px]">download</span>
                        Export CSV
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard>
                    <p className="text-sm font-medium text-slate-500 mb-1">Loop Completions</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums" data-testid="total-loops">
                        {loading ? '—' : totalLoops.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Full cycles verified</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm font-medium text-slate-500 mb-1">Integrity Score</p>
                    <p className="text-3xl font-bold text-emerald-500 tabular-nums" data-testid="avg-integrity-score">
                        {loading ? '—' : `${avgIntegrity}%`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Playlist adherence</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm font-medium text-slate-500 mb-1">Full Delivery</p>
                    <p className="text-3xl font-bold text-blue-500 tabular-nums" data-testid="full-delivery-count">
                        {loading ? '—' : `${fullDelivery}/${validRows.length}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Periods delivered 100%</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm font-medium text-slate-500 mb-1">Slot Failures</p>
                    <p className="text-3xl font-bold text-amber-500 tabular-nums" data-testid="slot-failures-count">
                        {loading ? '—' : slotFailures}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Needs attention</p>
                </GlassCard>
            </div>

            {/* Summary Table — primary view */}
            <GlassCard>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">table_rows</span>
                        {viewMode === 'week' ? '7-Day Summary' : `Hourly Breakdown — ${targetDate}`}
                    </h3>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-slate-400 animate-pulse text-sm">Loading analytics…</div>
                ) : apiUnavailable ? (
                    <div className="py-10 text-center text-slate-400 text-sm">
                        <span className="material-symbols-outlined text-3xl mb-2 block text-slate-300">cloud_off</span>
                        Data syncing — available shortly
                    </div>
                ) : activeRows.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">No data for this period.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="loop-analytics-summary-table">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="pb-3 pr-4">{viewMode === 'week' ? 'Date' : 'Time'}</th>
                                    <th className="pb-3 pr-4 text-right">Loop Completions</th>
                                    <th className="pb-3 pr-4 text-right">Integrity Score</th>
                                    <th className="pb-3 pr-4 text-right">Slot Failures</th>
                                    <th className="pb-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                                {activeRows.map((row, i) => (
                                    <tr
                                        key={i}
                                        onClick={() => viewMode === 'day' && setSelectedHour(
                                            selectedHour === (BUSINESS_HOURS.START + i) ? null : (BUSINESS_HOURS.START + i)
                                        )}
                                        className={`transition-colors ${viewMode === 'day' ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''} ${selectedHour === (BUSINESS_HOURS.START + i) ? 'bg-primary/5' : ''}`}
                                    >
                                        <td className="py-3 pr-4 font-medium text-slate-700 dark:text-slate-300">{row.label}</td>
                                        <td className="py-3 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                            {row.loopCompletions !== null ? row.loopCompletions.toLocaleString() : '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                            {row.integrityScore !== null ? `${row.integrityScore}%` : '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                            {row.slotFailures !== null ? row.slotFailures : '—'}
                                        </td>
                                        <td className="py-3">
                                            {row.status === 'UNAVAILABLE'
                                                ? <span className="text-xs text-slate-400">Unavailable</span>
                                                : <StatusBadge status={row.status === 'DELIVERED' ? 'Active' : 'Warning'} />
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {/* Slot-Level Detail (day view only, when hour selected) */}
            {viewMode === 'day' && selectedHour !== null && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">grid_view</span>
                            Slot Details — {formatHour(selectedHour)}
                        </h3>
                        <button
                            onClick={() => setSelectedHour(null)}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="slot-details">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                                data-testid={`slot-detail-${i}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Slot {i + 1}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">Slot data syncing — available shortly</div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Hourly Delivery Chart — secondary view */}
            {viewMode === 'day' && dayRows.length > 0 && !loading && !apiUnavailable && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">bar_chart</span>
                            Hourly Delivery Rates
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> &gt;99%</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> 95–99%</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> &lt;95%</span>
                        </div>
                    </div>
                    <div className="space-y-2" data-testid="hourly-chart">
                        {dayRows.map((item, idx) => {
                            const rate = parseFloat(item.integrityScore ?? 0);
                            const barColor = rate >= 99 ? 'bg-emerald-500' : rate >= 95 ? 'bg-amber-500' : 'bg-red-500';
                            const hour = BUSINESS_HOURS.START + idx;
                            return (
                                <button
                                    key={hour}
                                    onClick={() => setSelectedHour(selectedHour === hour ? null : hour)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all ${selectedHour === hour ? 'bg-primary/10 border border-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    data-testid={`analytics-hour-${hour}`}
                                >
                                    <div className="w-20 text-left font-bold text-sm">{formatHour(hour)}</div>
                                    <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${barColor} transition-all duration-500 flex items-center justify-end pr-3`}
                                            style={{ width: `${item.integrityScore ?? 0}%` }}
                                        >
                                            <span className="text-white text-xs font-bold">{item.integrityScore}%</span>
                                        </div>
                                    </div>
                                    <div className="w-24 text-right text-sm tabular-nums">
                                        <span className="font-bold">{item.loopCompletions}</span>
                                        <span className="text-slate-400 ml-1">cycles</span>
                                    </div>
                                    <div className="w-20">
                                        <StatusBadge status={item.status === 'DELIVERED' ? 'Active' : 'Warning'} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            {/* Empty State */}
            {!loading && !apiUnavailable && activeRows.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">analytics</span>
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">No Analytics Data</h3>
                    <p className="text-slate-500">No delivery data available for {targetDate}.</p>
                </div>
            )}
        </div>
    );
}

export default LoopAnalytics;
