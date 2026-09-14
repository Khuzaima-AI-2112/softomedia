import { useState } from 'react';
import { supportTicketAPI } from '../services/supportTicketAPI';
import { SUPPORT_TICKET_CATEGORIES } from '../constants/supportTickets';

/**
 * SupportTicketModal — a Retailer Administrator reports an operational issue.
 * Success is reported only after the backend persists the ticket.
 */
function SupportTicketModal({ onClose, onTicketCreated }) {
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState(SUPPORT_TICKET_CATEGORIES[0].value);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const ticket = await supportTicketAPI.create({ subject, category, description });
            onTicketCreated?.(ticket);
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
            <form
                data-testid="modal-support-ticket"
                onSubmit={handleSubmit}
                className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-xl"
            >
                <h2 className="text-xl font-bold mb-6">Report an issue</h2>

                <label htmlFor="ticket-subject" className="block text-sm font-medium mb-1">Subject</label>
                <input
                    id="ticket-subject"
                    data-testid="ticket-subject-input"
                    type="text"
                    required
                    maxLength={120}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="E.g., Checkout screen offline"
                    className="w-full mb-4 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 p-3 outline-none"
                />

                <label htmlFor="ticket-category" className="block text-sm font-medium mb-1">Category</label>
                <select
                    id="ticket-category"
                    data-testid="ticket-category-select"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full mb-4 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 p-3 outline-none"
                >
                    {SUPPORT_TICKET_CATEGORIES.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>

                <label htmlFor="ticket-description" className="block text-sm font-medium mb-1">Description</label>
                <textarea
                    id="ticket-description"
                    data-testid="ticket-description-input"
                    required
                    maxLength={2000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what you see on the screen..."
                    className="w-full min-h-[100px] rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 p-3 outline-none"
                />

                {error && (
                    <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        data-testid="btn-modal-close"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 p-3"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        data-testid="btn-submit-ticket"
                        disabled={submitting}
                        className="flex-1 rounded-lg bg-primary p-3 font-bold text-white disabled:opacity-60"
                    >
                        {submitting ? 'Submitting…' : 'Submit ticket'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default SupportTicketModal;
