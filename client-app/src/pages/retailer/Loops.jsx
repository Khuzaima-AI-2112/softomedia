import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';
import { loopListFrom } from '../../services/loopList';

// The server answers in document-id order, which puts 10:00 before 8:00.
const newestDayThenHour = (a, b) =>
    (b.date || '').localeCompare(a.date || '') || (a.hour ?? 24) - (b.hour ?? 24);

/**
 * Loops.jsx — Retailer Loop Library
 *
 * Sprint 9 — Task 9.5: New page. Registered in App.jsx at
 *   /dashboard/retailer/loops
 *
 * Shows all loops belonging to the retailer's locations with:
 *   - Loop name, date, hour slot, slot count
 *   - Link to the admin LoopBuilder for each loop
 *
 * Nobody approves an Hourly Loop (ADR 0007), so loops have no status to filter by.
 */
export default function RetailerLoops() {
    const [loops, setLoops]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);

    useEffect(() => {
        apiService.getLoops()
            .then(data => setLoops([...loopListFrom(data)].sort(newestDayThenHour)))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

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

            {loading && (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            )}

            {error && (
                <p className="text-red-500 p-4">Failed to load loops: {error}</p>
            )}

            {!loading && !error && loops.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">loop</span>
                    <p className="text-slate-500">No loops found for your locations.</p>
                </div>
            )}

            <div className="space-y-3" data-testid="loops-list">
                {loops.map(loop => (
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
