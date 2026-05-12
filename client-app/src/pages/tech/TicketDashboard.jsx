import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiClient from '../../services/api';

const PRIORITY_COLORS = {
    high: 'text-rose-500',
    medium: 'text-amber-500',
    low: 'text-emerald-500',
};

const STATUS_OPTIONS = ['all', 'open', 'in-progress', 'resolved'];
const PRIORITY_OPTIONS = ['all', 'high', 'medium', 'low'];
const PAGE_SIZE = 15;

function TicketDashboard() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page, limit: PAGE_SIZE });
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (priorityFilter !== 'all') params.append('priority', priorityFilter);
            const data = await apiClient.get(`/api/tickets?${params.toString()}`);
            setTickets(data.tickets || []);
            setTotalPages(data.totalPages || 1);
        } catch (err) {
            setError('Failed to load tickets.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, priorityFilter, page]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [statusFilter, priorityFilter]);

    const filterBtnStyle = (active) => ({
        fontSize: '0.75rem',
        fontWeight: active ? '600' : '400',
        padding: '0.3rem 0.75rem',
        borderRadius: '9999px',
        border: '1px solid',
        borderColor: active ? 'var(--color-primary, #01696f)' : '#e2e8f0',
        background: active ? 'var(--color-primary, #01696f)' : 'transparent',
        color: active ? '#fff' : '#64748b',
        cursor: 'pointer',
        transition: 'all 150ms',
    });

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Support Tickets</h1>
                    <p className="text-slate-500 dark:text-slate-400">Track and resolve screen alerts and support requests</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/tech')}
                    className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to Tech Ops
                </button>
            </div>

            {/* Filters */}
            <GlassCard>
                <div className="flex flex-wrap gap-6 items-center">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Status</p>
                        <div className="flex gap-2">
                            {STATUS_OPTIONS.map(s => (
                                <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => setStatusFilter(s)}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Priority</p>
                        <div className="flex gap-2">
                            {PRIORITY_OPTIONS.map(p => (
                                <button key={p} style={filterBtnStyle(priorityFilter === p)} onClick={() => setPriorityFilter(p)}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Table */}
            <GlassCard>
                {loading ? (
                    <div className="py-12 text-center text-slate-400">
                        <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                        <p className="mt-2 text-sm">Loading tickets…</p>
                    </div>
                ) : error ? (
                    <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-rose-400 text-4xl">error</span>
                        <p className="mt-2 text-sm text-rose-500">{error}</p>
                        <button onClick={fetchTickets} className="mt-4 text-xs text-primary underline">Retry</button>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-slate-300 text-5xl">inbox</span>
                        <p className="mt-3 font-medium text-slate-500">No tickets match the current filters.</p>
                        <p className="text-xs text-slate-400 mt-1">Adjust filters or wait for new screen alerts.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        {['Ticket ID', 'Screen ID', 'Status', 'Priority', 'Created At'].map(col => (
                                            <th key={col} className="pb-3 pt-1 text-xs font-bold text-slate-400 uppercase tracking-widest px-3">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {tickets.map(ticket => (
                                        <tr
                                            key={ticket.id}
                                            className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/dashboard/tech/tickets/${ticket.id}`)}
                                        >
                                            <td className="py-3 px-3 font-mono text-sm text-slate-600 dark:text-slate-300">{ticket.id}</td>
                                            <td className="py-3 px-3 text-sm text-slate-500 font-mono">{ticket.screenId || '—'}</td>
                                            <td className="py-3 px-3">
                                                <StatusBadge status={ticket.status} />
                                            </td>
                                            <td className={`py-3 px-3 text-sm font-semibold capitalize ${PRIORITY_COLORS[ticket.priority] || 'text-slate-500'}`}>
                                                {ticket.priority || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-sm text-slate-400">
                                                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </GlassCard>
        </div>
    );
}

export default TicketDashboard;
