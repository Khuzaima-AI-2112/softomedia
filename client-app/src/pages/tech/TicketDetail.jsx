import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiClient from '../../services/api';

const PRIORITY_COLORS = {
    high: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
    medium: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
    low: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
};

function TicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolving, setResolving] = useState(false);
    const [resolveSuccess, setResolveSuccess] = useState(false);

    useEffect(() => {
        const fetchTicket = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await apiClient.get(`/api/tickets/${id}`);
                setTicket(data);
                setResolutionNotes(data.resolutionNotes || '');
            } catch (err) {
                setError('Failed to load ticket details.');
            } finally {
                setLoading(false);
            }
        };
        fetchTicket();
    }, [id]);

    const handleResolve = async () => {
        setResolving(true);
        setResolveSuccess(false);
        try {
            const updated = await apiClient.put(`/api/tickets/${id}`, {
                status: 'resolved',
                resolutionNotes,
            });
            setTicket(updated);
            setResolveSuccess(true);
        } catch (err) {
            setError('Failed to resolve ticket. Please try again.');
        } finally {
            setResolving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            </div>
        );
    }

    if (error && !ticket) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <span className="material-symbols-outlined text-rose-400 text-5xl">error</span>
                <p className="mt-3 text-rose-500 font-medium">{error}</p>
                <button onClick={() => navigate(-1)} className="mt-4 text-sm text-primary underline">Go back</button>
            </div>
        );
    }

    const isResolved = ticket?.status === 'resolved';

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-400">
                <Link to="/dashboard/tech" className="hover:text-primary transition-colors">Tech Ops</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <Link to="/dashboard/tech/tickets" className="hover:text-primary transition-colors">Tickets</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">{ticket?.id}</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Ticket {ticket?.id}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Created {ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</p>
                </div>
                <StatusBadge status={ticket?.status} />
            </div>

            {/* Metadata */}
            <GlassCard>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Ticket Details</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Screen ID</p>
                        <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
                            {ticket?.screenId ? (
                                <Link
                                    to={`/dashboard/admin/screens`}
                                    className="text-primary hover:underline"
                                >
                                    {ticket.screenId}
                                </Link>
                            ) : '—'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Priority</p>
                        <span className={`text-sm font-semibold capitalize px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket?.priority] || 'text-slate-500'}` }>
                            {ticket?.priority || '—'}
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Created By</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{ticket?.createdBy || 'System'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Last Updated</p>
                        <p className="text-sm text-slate-500">{ticket?.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}</p>
                    </div>
                    {ticket?.description && (
                        <div className="col-span-2">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Description</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{ticket.description}</p>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Timeline */}
            <GlassCard>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Status Timeline</h3>
                {(!ticket?.timeline || ticket.timeline.length === 0) ? (
                    <p className="text-sm text-slate-400 italic">No timeline events yet.</p>
                ) : (
                    <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-4 ml-3">
                        {ticket.timeline.map((event, idx) => (
                            <li key={idx} className="ml-4">
                                <div className="absolute -left-1.5 mt-1 size-3 rounded-full bg-primary" />
                                <p className="text-xs text-slate-400">{new Date(event.at).toLocaleString()}</p>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                                    Status changed to <span className="capitalize font-bold">{event.status}</span>
                                    {event.by && <span className="text-slate-400 font-normal"> by {event.by}</span>}
                                </p>
                                {event.note && <p className="text-xs text-slate-500 mt-0.5 italic">{event.note}</p>}
                            </li>
                        ))}
                    </ol>
                )}
            </GlassCard>

            {/* Resolution */}
            <GlassCard>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Resolution</h3>
                {resolveSuccess && (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-sm font-medium">
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Ticket resolved and saved to Firestore.
                    </div>
                )}
                {error && (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-sm">
                        <span className="material-symbols-outlined text-[18px]">error</span>
                        {error}
                    </div>
                )}
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Resolution Notes
                </label>
                <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    disabled={isResolved}
                    rows={4}
                    placeholder={isResolved ? 'Ticket is already resolved.' : 'Describe the resolution or actions taken…'}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-end mt-4">
                    <button
                        onClick={handleResolve}
                        disabled={isResolved || resolving}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {resolving ? (
                            <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        )}
                        {isResolved ? 'Resolved' : resolving ? 'Resolving…' : 'Mark Resolved'}
                    </button>
                </div>
            </GlassCard>
        </div>
    );
}

export default TicketDetail;
