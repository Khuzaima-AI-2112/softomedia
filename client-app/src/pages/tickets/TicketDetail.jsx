/**
 * pages/tickets/TicketDetail.jsx
 *
 * Route: /dashboard/tickets/:id  (registered in App.jsx)
 * Everyone permitted to view the ticket sees its status and notes; only
 * Technical Operators and Super Administrators may change status or add notes.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../constants/roles';
import { supportTicketAPI } from '../../services/supportTicketAPI';
import {
    SUPPORT_TICKET_STATUSES,
    supportTicketCategoryLabel,
    supportTicketStatusLabel,
} from '../../constants/supportTickets';

const TICKET_MANAGER_ROLES = new Set([ROLES.TECHOPERATOR, ROLES.SUPERADMIN]);

const TicketDetail = () => {
    const { id } = useParams();
    const { persona } = useAuth();
    const [ticket, setTicket] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [status, setStatus] = useState('open');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const canManage = TICKET_MANAGER_ROLES.has(persona);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const data = await supportTicketAPI.get(id);
                if (!active) return;
                setTicket(data);
                setStatus(data.status);
            } catch (err) {
                if (active) setLoadError(err.message);
            }
        };
        load();
        return () => { active = false; };
    }, [id]);

    const handleSave = async (event) => {
        event.preventDefault();
        setSaving(true);
        setSaveError(null);
        try {
            const update = {
                ...(status !== ticket.status ? { status } : {}),
                ...(note.trim() ? { note } : {}),
            };
            const updated = await supportTicketAPI.update(id, update);
            setTicket(updated);
            setStatus(updated.status);
            setNote('');
        } catch (err) {
            setSaveError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loadError) {
        return (
            <div data-testid="error-state" className="p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-red-400 mb-3 block" aria-hidden="true">error</span>
                <p role="alert" className="text-slate-500">{loadError}</p>
                <Link to="/dashboard/tickets" className="mt-4 inline-flex items-center gap-1 text-primary hover:underline text-sm">
                    <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
                    Back to Support Tickets
                </Link>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="p-8 text-center text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                Loading Support Ticket...
            </div>
        );
    }

    const notes = Array.isArray(ticket.notes) ? ticket.notes : [];

    return (
        <div data-testid="ticket-detail" className="p-8 max-w-4xl mx-auto">
            <Link to="/dashboard/tickets" className="inline-flex items-center gap-1 text-primary hover:underline text-sm mb-4">
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
                Back to Support Tickets
            </Link>

            <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{ticket.subject}</h1>
                <span data-testid="ticket-status" className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {supportTicketStatusLabel(ticket.status)}
                </span>
            </div>
            <p className="text-sm text-slate-500 mb-6">
                {supportTicketCategoryLabel(ticket.category)}
                {' • '}
                {ticket.retailer_id}
                {' • '}
                {new Date(ticket.created_at).toLocaleString()}
            </p>

            <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Description</h2>
                <p className="whitespace-pre-wrap">{ticket.description}</p>
            </section>

            <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Updates</h2>
                {notes.length === 0 ? (
                    <p className="text-sm text-slate-400">No updates yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {notes.map(entry => (
                            <li key={entry.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                <p className="text-sm whitespace-pre-wrap">{entry.body}</p>
                                <span className="text-xs text-slate-400 mt-1 block">
                                    {entry.author_role} • {new Date(entry.created_at).toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {canManage && (
                <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Update ticket</h2>
                    <label htmlFor="ticket-status-select" className="block text-sm font-medium mb-1">Status</label>
                    <select
                        id="ticket-status-select"
                        data-testid="ticket-status-select"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="w-full mb-4 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 p-3 outline-none"
                    >
                        {SUPPORT_TICKET_STATUSES.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <label htmlFor="ticket-note-input" className="block text-sm font-medium mb-1">Note</label>
                    <textarea
                        id="ticket-note-input"
                        data-testid="ticket-note-input"
                        maxLength={2000}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="w-full min-h-[100px] rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 p-3 outline-none"
                    />
                    {saveError && <p role="alert" className="mt-3 text-sm text-red-600">{saveError}</p>}
                    <div className="flex justify-end mt-4">
                        <button
                            type="submit"
                            data-testid="btn-save-ticket-update"
                            disabled={saving}
                            className="px-4 py-2 bg-primary text-white rounded-lg font-bold disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : 'Save update'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default TicketDetail;
