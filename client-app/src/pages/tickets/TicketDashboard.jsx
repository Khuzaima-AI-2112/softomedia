/**
 * pages/tickets/TicketDashboard.jsx
 *
 * Promoted from components/TicketDashboard.jsx (Sprint 10).
 * Changes from the original component:
 *   - Fetch URL: hardcoded localhost:8080 → API_URL from config
 *   - Added empty-state UI (was silently blank on no tickets)
 *   - Added error-state UI (was silently blank on fetch failure)
 *
 * Route: /dashboard/tickets  (registered in App.jsx)
 * Auth:  inherits DashboardLayout authentication — no extra guard needed.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../config';

const TicketDashboard = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`${API_URL}/ghost-api/tickets`)
            .then(res => {
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                return res.json();
            })
            .then(data => {
                setTickets(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load tickets', err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                Loading Archives...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-red-400 mb-3 block">error</span>
                <p className="text-slate-500">Could not load tickets: {error}</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Ticket Archives
            </h1>

            {tickets.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-4 block">inbox</span>
                    <p className="text-lg">No tickets yet</p>
                    <p className="text-sm mt-1">Submitted support tickets will appear here.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {tickets.map(ticket => (
                        <Link
                            key={ticket.id}
                            to={`/dashboard/tickets/${ticket.id}`}
                            className="block p-6 bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-mono text-slate-400">#{ticket.id}</span>
                                    <div className="text-lg font-semibold mt-1">
                                        {new Date(ticket.timestamp).toLocaleString()}
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TicketDashboard;
