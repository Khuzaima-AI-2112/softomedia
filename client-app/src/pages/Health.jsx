import { useEffect, useState, useCallback } from 'react';
import apiClient from '../services/api';

const REFRESH_INTERVAL = 30000; // 30 seconds

const getLatencyColor = (ms) => {
    if (ms === null || ms === undefined) return 'checking';
    if (ms < 200) return 'green';
    if (ms < 800) return 'yellow';
    return 'red';
};

const pillStyle = (color) => {
    const map = {
        green:    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' },
        yellow:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600',   dot: 'bg-amber-400 animate-pulse' },
        red:      { bg: 'bg-rose-50 dark:bg-rose-900/20',     text: 'text-rose-600',     dot: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' },
        checking: { bg: 'bg-slate-50 dark:bg-slate-800',      text: 'text-slate-400',    dot: 'bg-slate-300 animate-pulse' },
    };
    return map[color] || map.checking;
};

const Health = () => {
    const [health, setHealth] = useState(null);
    const [lastChecked, setLastChecked] = useState(null);
    const [checking, setChecking] = useState(true);

    const fetchHealth = useCallback(async () => {
        setChecking(true);
        const start = performance.now();
        try {
            const data = await apiClient.get('/api/health/v2');
            const latency = Math.round(performance.now() - start);
            setHealth({
                status: data.status,
                version: data.version,
                uptime: data.uptime,
                environment: data.environment,
                firestoreMode: data.diagnostics?.persistence?.mode || 'unknown',
                breakers: data.diagnostics?.persistence?.breakers || [],
                adServerLatency: latency,
                // Cloud Storage and Firestore latencies are inferred from breaker states
                firestoreLatency: data.diagnostics?.persistence?.breakers?.[0]?.state === 'OPEN' ? null : latency,
                cloudStorageLatency: data.diagnostics?.persistence?.breakers?.[1]?.state === 'OPEN' ? null : latency,
            });
            setLastChecked(new Date());
        } catch {
            setHealth(prev => ({ ...prev, status: 'error', adServerLatency: null }));
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    const ServiceRow = ({ label, latencyMs, icon }) => {
        const color = checking ? 'checking' : getLatencyColor(latencyMs);
        const styles = pillStyle(color);
        return (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">{icon}</span>
                    <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">{label}</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${styles.bg} ${styles.text}`}>
                    <span className={`size-2 rounded-full flex-shrink-0 ${styles.dot}`} />
                    {checking
                        ? 'Checking…'
                        : latencyMs !== null && latencyMs !== undefined
                            ? `${latencyMs}ms — ${color === 'green' ? 'Healthy' : color === 'yellow' ? 'Degraded' : 'Slow'}`
                            : 'Unreachable'
                    }
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-3xl">health_metrics</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">System Health</h1>
                            <p className="text-slate-500 text-sm">Real-time infrastructure status · auto-refresh 30s</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchHealth}
                        disabled={checking}
                        aria-label="Refresh health status"
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                    >
                        <span className={`material-symbols-outlined text-slate-400 text-[20px] ${checking ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>

                {health?.status && (
                    <div className={`mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                        health.status === 'healthy' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' :
                        health.status === 'degraded' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700' :
                        'bg-rose-50 dark:bg-rose-900/20 text-rose-700'
                    }`}>
                        <span className="material-symbols-outlined text-[18px]">
                            {health.status === 'healthy' ? 'check_circle' : health.status === 'degraded' ? 'warning' : 'error'}
                        </span>
                        {health.status === 'healthy' ? 'All systems operational' :
                         health.status === 'degraded' ? 'One or more systems degraded' : 'System error detected'}
                    </div>
                )}

                <div className="space-y-3" data-testid="health-status">
                    <ServiceRow label="Ad-Server API" latencyMs={health?.adServerLatency} icon="api" />
                    <ServiceRow label="Firestore" latencyMs={health?.firestoreLatency} icon="database" />
                    <ServiceRow label="Cloud Storage" latencyMs={health?.cloudStorageLatency} icon="cloud" />
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                    <span>ENV: {health?.environment?.toUpperCase() || '—'} · MODE: {health?.firestoreMode?.toUpperCase() || '—'}</span>
                    <span>
                        {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking…'}
                        {health?.uptime ? ` · Uptime ${health.uptime}` : ''}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Health;
