import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiClient from '../../services/api';

function TechOpsDashboard() {
    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, screens: [] });
    const [, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const data = await apiClient.get('/api/monitoring/status');
            const onlineCount = data.screens.filter(s => s.status?.toUpperCase() === 'ONLINE').length;
            const offlineCount = data.screens.filter(s => s.status?.toUpperCase() === 'OFFLINE').length;
            setStats({ ...data, online: onlineCount, offline: offlineCount });
        } catch (error) {
            console.error('Failed to fetch screen status', error);
        } finally {
            setLoading(false);
        }
    };

    const healthPct = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0;
    const healthColor =
        healthPct >= 80 ? 'text-emerald-500' :
        healthPct >= 50 ? 'text-amber-500' :
        'text-rose-500';

    const filteredScreens = stats.screens.filter(s =>
        !searchQuery || String(s.id).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 px-1">

            {/* Page header */}
            <div className="flex items-end justify-between gap-4 pt-2">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                        Technical Operations
                    </h1>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                        Network-wide screen health and diagnostic tracking
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400 mb-0.5">
                        Global Health
                    </p>
                    <p className={`text-2xl font-black tabular-nums leading-none ${healthColor}`}>
                        {healthPct}%
                    </p>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Managed Fleet */}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Managed Fleet
                        </span>
                        <span className="w-7 h-7 rounded-lg bg-primary/8 dark:bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[16px]">display_settings</span>
                        </span>
                    </div>
                    <p className="text-4xl font-black tabular-nums text-slate-900 dark:text-white leading-none">
                        {stats.total}
                    </p>
                    <p className="text-xs text-slate-400 leading-snug">Active Screen Registry</p>
                </div>

                {/* Currently Online */}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Currently Online
                        </span>
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <span className="material-symbols-outlined text-[16px]">sensors</span>
                        </span>
                    </div>
                    <p className="text-4xl font-black tabular-nums text-emerald-500 leading-none">
                        {stats.online}
                    </p>
                    <p className="text-xs text-slate-400 leading-snug">Heartbeat active ({'< 2m'})</p>
                </div>

                {/* Connection Lost */}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            Connection Lost
                        </span>
                        <span className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <span className="material-symbols-outlined text-[16px]">error_outline</span>
                        </span>
                    </div>
                    <p className="text-4xl font-black tabular-nums text-rose-500 leading-none">
                        {stats.offline}
                    </p>
                    <p className="text-xs text-slate-400 leading-snug">Requires immediate audit</p>
                </div>
            </div>

            {/* Screen Inventory */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Table header bar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">list_alt</span>
                        Screen Inventory &amp; Health
                    </h2>
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <span className="material-symbols-outlined text-[14px]">search</span>
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search screen ID…"
                            className="text-xs pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 w-48 transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                                <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Screen ID
                                </th>
                                <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Status
                                </th>
                                <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Last Sync
                                </th>
                                <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScreens.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-14 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-slate-600">
                                                desktop_windows
                                            </span>
                                            <p className="text-sm text-slate-400 italic">
                                                {searchQuery
                                                    ? 'No screens match your search.'
                                                    : 'No screens detected in the registry.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredScreens.map((screen, idx) => (
                                    <tr
                                        key={screen.id}
                                        className={`group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                                            idx !== filteredScreens.length - 1
                                                ? 'border-b border-slate-50 dark:border-slate-800/60'
                                                : ''
                                        }`}
                                    >
                                        <td className="py-3.5 px-5 font-mono text-sm text-slate-600 dark:text-slate-300">
                                            {screen.id}
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <StatusBadge status={screen.status === 'ONLINE' ? 'Online' : 'Offline'} />
                                        </td>
                                        <td className="py-3.5 px-5 text-sm text-slate-400 tabular-nums">
                                            {screen.last_seen
                                                ? new Date(screen.last_seen).toLocaleTimeString()
                                                : <span className="italic text-slate-300 dark:text-slate-600">Never</span>}
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 dark:hover:bg-primary/10 transition-colors disabled:opacity-30"
                                                    aria-label="Restart screen"
                                                    title="Restart"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/8 dark:hover:bg-primary/10 transition-colors"
                                                    aria-label="Open terminal"
                                                    title="Terminal"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">terminal</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer count */}
                {filteredScreens.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                        <p className="text-xs text-slate-400">
                            Showing <span className="font-medium text-slate-600 dark:text-slate-300">{filteredScreens.length}</span> of{' '}
                            <span className="font-medium text-slate-600 dark:text-slate-300">{stats.total}</span> screen{stats.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TechOpsDashboard;
