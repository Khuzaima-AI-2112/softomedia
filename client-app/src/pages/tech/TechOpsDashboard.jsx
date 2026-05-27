import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import { API_URL } from '../../config';

const HAMBURGER_EXPERIMENTS = [
  {
    id: 'variant-a',
    label: 'Variant A',
    description: 'Current production — left slide-in drawer, backdrop blur, 2-col swatch grid',
    href: '/experiments/hamburger-variant-a.html',
    badge: 'Production',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    iconColor: 'text-emerald-500',
  },
  {
    id: 'variant-b',
    label: 'Variant B',
    description: 'Compact top sheet — drops below header, 3-col desktop layout, no full overlay',
    href: '/experiments/hamburger-variant-b.html',
    badge: 'Experiment',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    iconColor: 'text-amber-500',
  },
  {
    id: 'variant-c',
    label: 'Variant C',
    description: 'Right-side wide drawer — trigger on right, w-80, single-col role list with check mark',
    href: '/experiments/hamburger-variant-c.html',
    badge: 'Experiment',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    iconColor: 'text-amber-500',
  },
  {
    id: 'variant-index',
    label: 'All Variants',
    description: 'Side-by-side index — all 3 experiments on one screen for comparison',
    href: '/experiments/hamburger-index.html',
    badge: 'Index',
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    iconColor: 'text-slate-400',
  },
];

function TechOpsDashboard() {
    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, screens: [] });
    const [, setLoading] = useState(true);

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

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
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

            {/* ── Design Lab ── */}
            <GlassCard>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">experiment</span>
                        Design Lab — Hamburger Menu Experiments
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Tech Op only</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {HAMBURGER_EXPERIMENTS.map((exp) => (
                        <a
                            key={exp.id}
                            href={exp.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-150"
                        >
                            <span className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${exp.iconColor} group-hover:scale-110 transition-transform duration-150`}>
                                menu
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{exp.label}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${exp.badgeClass}`}>{exp.badge}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{exp.description}</p>
                            </div>
                            <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-primary shrink-0 mt-0.5 transition-colors duration-150">
                                arrow_outward
                            </span>
                        </a>
                    ))}
                </div>
            </GlassCard>

            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">list_alt</span>
                        Screen Inventory & Health
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search screen ID..."
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
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
                            {stats.screens.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-slate-500 italic">No screens detected in the registry.</td>
                                </tr>
                            ) : (
                                stats.screens.map(screen => (
                                    <tr key={screen.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 px-4 font-mono text-sm text-slate-600 dark:text-slate-300">{screen.id}</td>
                                        <td className="py-4 px-4">
                                            <StatusBadge status={screen.status === 'ONLINE' ? 'Online' : 'Offline'} />
                                        </td>
                                        <td className="py-4 px-4 text-sm text-slate-500">
                                            {screen.last_seen ? new Date(screen.last_seen).toLocaleTimeString() : 'Never'}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <button className="p-1 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors disabled:opacity-30">
                                                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                                            </button>
                                            <button className="p-1 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">terminal</span>
                                            </button>
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
