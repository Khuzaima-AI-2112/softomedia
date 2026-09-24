import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiService from '../../services/ApiService';
import { loopListFrom } from '../../services/loopList';

/**
 * Loops.jsx — Retailer Loop Library
 *
 * Sprint 9 — Task 9.5: New page. Registered in App.jsx at
 *   /dashboard/retailer/loops
 *
 * Shows all loops belonging to the retailer's locations with:
 *   - Loop name, date, hour slot, slot count
 *   - Status badge (approved / pending / draft / locked)
 *   - Link to the admin LoopBuilder for each loop
 *   - Quick-filter by status
 *
 * Sprint 11 — S11-5 fixes:
 *   - data-testid attributes added: loops-list, loop-row-{id}, loop-status-badge-{id}
 *   - Status filter values changed to lowercase to match schema enum
 *     (approved | draft | locked — per #42 guardrail G4)
 *   - Added 'locked' filter tab (was missing)
 *   - Comparison now uses l.status?.toLowerCase() for case-insensitive safety
 */
export default function RetailerLoops() {
    const [loops, setLoops]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    // filter values match schema enum exactly: approved | draft | locked
    const [filter, setFilter]     = useState('all');

    useEffect(() => {
        apiService.getLoops()
            .then(data => setLoops(loopListFrom(data)))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === 'all'
        ? loops
        : loops.filter(l => (l.status || '').toLowerCase() === filter);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Loop Library
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        View and manage broadcast loops for your locations.
                    </p>
                </div>
                <Link
                    to="/dashboard/retailer/schedule"
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium
                        hover:bg-primary/90 transition-colors shrink-0"
                >
                    ← Schedule Calendar
                </Link>
            </div>

            {/* Status filter tabs — values match schema enum (lowercase) */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'approved', 'pending', 'draft', 'locked'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                            ${
                                filter === f
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            )}

            {error && (
                <p className="text-red-500 p-4">Failed to load loops: {error}</p>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">loop</span>
                    <p className="text-slate-500">
                        {filter === 'all' ? 'No loops found for your locations.' : `No ${filter} loops.`}
                    </p>
                </div>
            )}

            <div className="space-y-3" data-testid="loops-list">
                {filtered.map(loop => (
                    <GlassCard
                        key={loop.id}
                        className="flex items-center justify-between gap-4 p-4"
                        data-testid={`loop-row-${loop.id}`}
                    >
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                                {loop.name || `Loop ${loop.id}`}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {loop.date ? `${loop.date} • ` : ''}
                                {loop.hour != null ? `${loop.hour}:00 slot` : 'No hour assigned'}
                                {loop.slots?.length != null && (
                                    <span className="ml-2">{loop.slots.length} slot{loop.slots.length !== 1 ? 's' : ''}</span>
                                )}
                            </p>
                        </div>

                        <span data-testid={`loop-status-badge-${loop.id}`}>
                            <StatusBadge status={loop.status} />
                        </span>

                        <Link
                            to={`/dashboard/admin/loops/${loop.id}`}
                            className="px-3 py-1.5 rounded text-sm border border-slate-200 dark:border-slate-700
                                text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800
                                transition-colors shrink-0"
                        >
                            View
                        </Link>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
}
