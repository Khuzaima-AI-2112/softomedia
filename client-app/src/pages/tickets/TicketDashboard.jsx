/**
 * pages/tickets/TicketDashboard.jsx
 *
 * Route: /dashboard/tickets  (registered in App.jsx)
 * Retailer Administrators see and report their organization's Support Tickets;
 * Technical Operators and Super Administrators see tickets across the network.
 * Other roles receive the backend's denial.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../constants/permissions';
import SupportTicketModal from '../../components/SupportTicketModal';
import { supportTicketAPI } from '../../services/supportTicketAPI';
import { supportTicketCategoryLabel, supportTicketStatusLabel } from '../../constants/supportTickets';

const TicketDashboard = () => {
    const { can } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [notice, setNotice] = useState('');
    const canReport = can(PERMISSIONS.SUPPORT_TICKET_CREATE_OWN);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const data = await supportTicketAPI.list();
                if (active) setTickets(Array.isArray(data) ? data : []);
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, []);

    const handleTicketCreated = (ticket) => {
        setTickets(previous => [ticket, ...previous]);
        setShowModal(false);
        setNotice('Support Ticket submitted.');
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                Loading Support Tickets...
            </div>
        );
    }

    if (error) {
        return (
            <div data-testid="error-state" className="p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-red-400 mb-3 block" aria-hidden="true">error</span>
                <p role="alert" className="text-slate-500">{error}</p>
            </div>
        );
    }

    return (
        <div data-testid="ticket-dashboard" className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary" aria-hidden="true">confirmation_number</span>
                    Support Tickets
                </h1>
                {canReport && (
                    <button
                        data-testid="btn-create-ticket"
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg"
                    >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                        Create Ticket
                    </button>
                )}
            </div>

            {notice && <p role="status" className="mb-4 text-sm text-emerald-700">{notice}</p>}

            {tickets.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-4 block" aria-hidden="true">inbox</span>
                    <p className="text-lg">No Support Tickets</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {tickets.map(ticket => (
                        <Link
                            key={ticket.id}
                            data-testid={`ticket-card-${ticket.id}`}
                            to={`/dashboard/tickets/${ticket.id}`}
                            className="block p-6 bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all"
                        >
                            <div className="flex justify-between items-center gap-4">
                                <div>
                                    <div className="text-lg font-semibold">{ticket.subject}</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        {supportTicketCategoryLabel(ticket.category)}
                                        {' • '}
                                        {ticket.retailer_id}
                                        {' • '}
                                        {new Date(ticket.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    {supportTicketStatusLabel(ticket.status)}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            {showModal && (
                <SupportTicketModal onClose={() => setShowModal(false)} onTicketCreated={handleTicketCreated} />
            )}
        </div>
    );
};

export default TicketDashboard;
