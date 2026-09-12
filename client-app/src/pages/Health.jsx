import { useCallback, useEffect, useState } from 'react';
import apiService from '../services/ApiService';

const UNKNOWN_DEPENDENCIES = {
    backend: { state: 'unknown' },
    firestore: { state: 'unknown' },
    storage: { state: 'unknown' },
    checked_at: null,
};

function labelForState(state) {
    if (state === 'healthy') return 'Healthy';
    if (state === 'unavailable') return 'Unavailable';
    return 'Unknown';
}

function StatusIndicator({ state, testId }) {
    const color = state === 'healthy'
        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
        : state === 'unavailable'
            ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
            : 'bg-amber-500';
    return (
        <div data-testid={testId} data-status={state} className="flex items-center gap-3">
            <div className={`size-3 rounded-full ${color}`} />
            <span className="font-medium text-slate-700 dark:text-slate-300">{labelForState(state)}</span>
        </div>
    );
}

const Health = () => {
    const [dependencies, setDependencies] = useState(UNKNOWN_DEPENDENCIES);
    const [fleet, setFleet] = useState({ total: 0, online: 0, offline: 0, screens: [] });

    const refresh = useCallback(async () => {
        const [dependencyResult, fleetResult] = await Promise.allSettled([
            apiService.getOperationalHealth(),
            apiService.getScreenStatus(),
        ]);
        setDependencies(dependencyResult.status === 'fulfilled'
            ? dependencyResult.value
            : {
                backend: { state: 'unavailable' },
                firestore: { state: 'unknown' },
                storage: { state: 'unknown' },
                checked_at: null,
            });
        if (fleetResult.status === 'fulfilled') setFleet(fleetResult.value);
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 30_000);
        return () => clearInterval(interval);
    }, [refresh]);

    const allHealthy = ['backend', 'firestore', 'storage']
        .every(key => dependencies[key]?.state === 'healthy');

    return (
        <div data-testid="health-dashboard" className="max-w-5xl mx-auto py-12 px-6 space-y-8">
            <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-3xl">health_metrics</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">System Health</h1>
                        <p data-testid="health-status-banner" className="text-slate-500 text-sm">
                            {allHealthy ? 'All checked dependencies are healthy' : 'Some dependencies are unavailable or unknown'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4" data-testid="health-status">
                    {[
                        ['Backend API', 'backend', 'health-chip-adserver'],
                        ['Firestore', 'firestore', 'health-chip-firestore'],
                        ['Cloud Storage', 'storage', 'health-chip-storage'],
                    ].map(([label, key, testId]) => (
                        <div key={key} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                            <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">{label}</span>
                            <StatusIndicator state={dependencies[key]?.state || 'unknown'} testId={testId} />
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-xl font-bold">Screen Health</h2>
                        <p className="text-sm text-slate-500">Connectivity is based only on the latest heartbeat.</p>
                    </div>
                    <span className="text-sm text-slate-500">{fleet.online}/{fleet.total} online</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left" aria-label="Screen health">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="p-3">Screen</th>
                                <th className="p-3">Connectivity</th>
                                <th className="p-3">Approved schedule</th>
                                <th className="p-3">Last heartbeat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fleet.screens.map(screen => (
                                <tr key={screen.id} className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="p-3 font-mono text-sm">{screen.screen_id || screen.id}</td>
                                    <td className="p-3">
                                        {screen.connectivity === 'online' ? 'Online' : 'Offline'}
                                    </td>
                                    <td className="p-3">
                                        {screen.schedule?.approved ? 'Available' : 'No approved schedule'}
                                    </td>
                                    <td className="p-3 text-sm text-slate-500">
                                        {screen.last_seen ? new Date(screen.last_seen).toLocaleString() : 'Never'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Health;
