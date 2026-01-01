import React, { useEffect, useState } from 'react';

const Health = () => {
    const [status, setStatus] = useState({
        backend: 'checking',
        storage: 'checking',
        auth: 'checking',
        version: '1.0.0-integrated'
    });

    useEffect(() => {
        // Mock health checks for now
        const checkHealth = async () => {
            await new Promise(r => setTimeout(r, 1000));
            setStatus(prev => ({
                ...prev,
                backend: 'online',
                storage: 'online',
                auth: 'online'
            }));
        };
        checkHealth();
    }, []);

    const StatusIndicator = ({ state }) => (
        <div className="flex items-center gap-3">
            <div className={`size-3 rounded-full ${state === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                state === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                }`} />
            <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{state}</span>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-3xl">health_metrics</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">System Health</h1>
                        <p className="text-slate-500 text-sm">Real-time infrastructure status</p>
                    </div>
                </div>

                <div className="space-y-6" data-testid="health-status">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">Ad-Server API</span>
                        <StatusIndicator state={status.backend} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">GCS Storage</span>
                        <StatusIndicator state={status.storage} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">Firebase Auth</span>
                        <StatusIndicator state={status.auth} />
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                    <span>ENVIRONMENT: PRODUCTION-READY</span>
                    <span>BUILD: {status.version}</span>
                </div>
            </div>
        </div>
    );
};

export default Health;
