import { useState, useEffect, useMemo, useCallback } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import { API_URL } from '../../config';

function TechOpsDashboard() {
    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, screens: [] });
    const [, setLoading] = useState(true);

    // Task 4.2 — restart confirmation
    const [restartTarget, setRestartTarget] = useState(null); // null | { id, label }
    const [restartLoading, setRestartLoading] = useState(false);
    const [restartResults, setRestartResults] = useState({}); // { [screenId]: 'success' | 'error' }

    // Task 4.4 — terminal log viewer
    const [terminalTarget, setTerminalTarget] = useState(null); // null | { id }
    const [terminalLogs, setTerminalLogs] = useState([]);       // ImpressionRecord[]
    const [terminalLoading, setTerminalLoading] = useState(false);
    const [terminalError, setTerminalError] = useState(null);

    // Task 4.5 — search + filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/api/monitoring/status`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch screen status', error);
        } finally {
            setLoading(false);
        }
    };

    // Task 4.4 — fetch logs when terminal panel opens
    const fetchTerminalLogs = useCallback(async (screenId) => {
        setTerminalLoading(true);
        setTerminalError(null);
        setTerminalLogs([]);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/screens/${screenId}/logs`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setTerminalLogs(data.logs || []);
        } catch (err) {
            setTerminalError(err.message);
        } finally {
            setTerminalLoading(false);
        }
    }, []);

    const openTerminal = useCallback((screen) => {
        setTerminalTarget({ id: screen.id });
        fetchTerminalLogs(screen.id);
    }, [fetchTerminalLogs]);

    const closeTerminal = useCallback(() => {
        setTerminalTarget(null);
        setTerminalLogs([]);
        setTerminalError(null);
    }, []);

    // Task 4.2 + 4.3 — restart with confirmation + audit log
    const handleRestartConfirm = async () => {
        if (!restartTarget) return;
        setRestartLoading(true);
        const screenId = restartTarget.id;
        let outcome = 'failure';
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/screens/${screenId}/restart`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            outcome = res.ok ? 'success' : 'failure';
            setRestartResults(prev => ({ ...prev, [screenId]: res.ok ? 'success' : 'error' }));
        } catch {
            setRestartResults(prev => ({ ...prev, [screenId]: 'error' }));
        } finally {
            // Task 4.3 — audit log entry (fire-and-forget; failure does not block restart result)
            try {
                const token = localStorage.getItem('auth_token');
                await fetch(`${API_URL}/api/audit`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'screen_restart',
                        screen_id: screenId,
                        user_id: localStorage.getItem('user_id') || 'unknown',
                        timestamp: new Date().toISOString(),
                        outcome,
                    }),
                });
            } catch {
                // audit log failure is silent — does not surface to user
            }
            setRestartLoading(false);
            setRestartTarget(null);
            // Auto-clear result badge after 4s
            setTimeout(() => {
                setRestartResults(prev => { const n = { ...prev }; delete n[screenId]; return n; });
            }, 4000);
        }
    };

    // Task 4.5 — client-side filter
    const uniqueLocations = useMemo(() => {
        const locs = stats.screens.map(s => s.location).filter(Boolean);
        return [...new Set(locs)].sort();
    }, [stats.screens]);

    const filteredScreens = useMemo(() => {
        return stats.screens.filter(screen => {
            const matchesSearch = !searchQuery ||
                (screen.id || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'online' && screen.status === 'ONLINE') ||
                (statusFilter === 'offline' && screen.status !== 'ONLINE');
            const matchesLocation = locationFilter === 'all' ||
                screen.location === locationFilter;
            return matchesSearch && matchesStatus && matchesLocation;
        });
    }, [stats.screens, searchQuery, statusFilter, locationFilter]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Task 4.2 — restart confirmation dialog */}
            {restartTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">restart_alt</span>
                            Confirm Restart
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            Restart screen <strong className="font-mono">{restartTarget.id}</strong>?
                            This will interrupt active playback.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setRestartTarget(null)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRestartConfirm}
                                disabled={restartLoading}
                                className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-all disabled:opacity-60 flex items-center gap-2"
                            >
                                {restartLoading && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
                                {restartLoading ? 'Restarting\u2026' : 'Yes, Restart'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task 4.4 — terminal log viewer slide-over */}
            {terminalTarget && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={closeTerminal}
                    />
                    <div className="relative w-full max-w-lg bg-slate-900 text-slate-100 flex flex-col shadow-2xl z-10">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">terminal</span>
                                <span className="font-mono text-sm font-bold">{terminalTarget.id}</span>
                                <span className="text-xs text-slate-400">Activity Log</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {!terminalLoading && (
                                    <button
                                        onClick={() => fetchTerminalLogs(terminalTarget.id)}
                                        aria-label="Refresh logs"
                                        className="text-slate-400 hover:text-white transition-colors p-1"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                                    </button>
                                )}
                                <button
                                    onClick={closeTerminal}
                                    className="text-slate-400 hover:text-white transition-colors"
                                    aria-label="Close log viewer"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                            {terminalLoading && (
                                <div className="space-y-2 animate-pulse">
                                    {[...Array(8)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-3 rounded bg-slate-700"
                                            style={{ width: `${55 + (i % 4) * 10}%` }}
                                        />
                                    ))}
                                </div>
                            )}

                            {!terminalLoading && terminalError && (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                    <span className="material-symbols-outlined text-[36px] text-rose-500">error</span>
                                    <p className="text-rose-400 text-xs">Failed to load logs</p>
                                    <p className="text-slate-500 text-[11px]">{terminalError}</p>
                                    <button
                                        onClick={() => fetchTerminalLogs(terminalTarget.id)}
                                        className="mt-2 text-xs text-primary hover:underline"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            {!terminalLoading && !terminalError && terminalLogs.length === 0 && (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                    <span className="material-symbols-outlined text-[36px] text-slate-600">receipt_long</span>
                                    <p className="text-slate-400 text-xs">No activity recorded yet for this screen.</p>
                                </div>
                            )}

                            {!terminalLoading && !terminalError && terminalLogs.map((log, i) => (
                                <div key={log.impression_id || i} className="flex gap-2 text-[11px] leading-5">
                                    <span className="text-slate-500 shrink-0 tabular-nums">
                                        {log.timestamp
                                            ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                            : '--:--:--'}
                                    </span>
                                    <span className="text-emerald-400 shrink-0">PLAY</span>
                                    <span className="text-slate-300 truncate">
                                        {log.campaign_id || '(unknown campaign)'}
                                    </span>
                                    {log.asset_id && (
                                        <span className="text-slate-500 truncate">· {log.asset_id}</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="px-5 py-3 border-t border-slate-700 text-[10px] text-slate-500 flex justify-between">
                            <span>{terminalLogs.length} entr{terminalLogs.length === 1 ? 'y' : 'ies'}</span>
                            <span>Showing last 100 · newest first</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Technical Operations</h1>
                    <p className="text-slate-500 dark:text-slate-400">Network-wide screen health and diagnostic tracking</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Global Health</p>
                        <p className="text-2xl font-black text-emerald-500">{stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}%</p>
                    </div>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-bold text-slate-500 mb-1">Managed Fleet</p>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">display_settings</span>
                        Active Screen Registry
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-bold text-slate-500 mb-1">Currently Online</p>
                    <p className="text-4xl font-black text-emerald-500">{stats.online}</p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">sensors</span>
                        Heartbeat active ({'< 2m'})
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-rose-500">
                    <p className="text-sm font-bold text-slate-500 mb-1">Connection Lost</p>
                    <p className="text-4xl font-black text-rose-500">{stats.offline}</p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        Requires immediate audit
                    </p>
                </GlassCard>
            </div>

            {/* Screen Inventory */}
            <GlassCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <h3 className="font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">list_alt</span>
                        Screen Inventory &amp; Health
                    </h3>
                    {/* Task 4.5 — search + status + location filters, all wired */}
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="text"
                            placeholder="Search screen ID\u2026"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="all">All Status</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                        </select>
                        {uniqueLocations.length > 0 && (
                            <select
                                value={locationFilter}
                                onChange={e => setLocationFilter(e.target.value)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="all">All Locations</option>
                                {uniqueLocations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="pb-4 pt-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-4">Screen ID</th>
                                <th className="pb-4 pt-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-4">Status</th>
                                <th className="pb-4 pt-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-4">Last Sync</th>
                                <th className="pb-4 pt-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredScreens.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-slate-500 italic">
                                        {stats.screens.length === 0
                                            ? 'No screens detected in the registry.'
                                            : 'No screens match the current filters.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredScreens.map(screen => (
                                    <tr key={screen.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 px-4 font-mono text-sm text-slate-600 dark:text-slate-300">{screen.id}</td>
                                        <td className="py-4 px-4">
                                            <StatusBadge status={screen.status === 'ONLINE' ? 'Online' : 'Offline'} />
                                        </td>
                                        <td className="py-4 px-4 text-sm text-slate-500">
                                            {screen.last_seen ? new Date(screen.last_seen).toLocaleTimeString() : 'Never'}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Task 4.2 — restart with confirmation */}
                                                {restartResults[screen.id] === 'success' && (
                                                    <span className="text-xs text-emerald-500 mr-1">Restarted</span>
                                                )}
                                                {restartResults[screen.id] === 'error' && (
                                                    <span className="text-xs text-rose-500 mr-1">Failed</span>
                                                )}
                                                <button
                                                    onClick={() => setRestartTarget({ id: screen.id })}
                                                    disabled={restartLoading}
                                                    aria-label={`Restart screen ${screen.id}`}
                                                    className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-30"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                                                </button>
                                                {/* Task 4.4 — terminal opens live activity log panel */}
                                                <button
                                                    onClick={() => openTerminal(screen)}
                                                    aria-label={`Open log viewer for screen ${screen.id}`}
                                                    className="p-1 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}

export default TechOpsDashboard;
