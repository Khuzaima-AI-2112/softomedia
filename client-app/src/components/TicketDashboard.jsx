import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TicketDashboard = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:8080/ghost-api/tickets')
            .then(res => res.json())
            .then(data => {
                setTickets(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load tickets', err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-8 text-center">Loading Archives...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Ticket Archives
            </h1>

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
        </div>
    );
};

export default TicketDashboard;
