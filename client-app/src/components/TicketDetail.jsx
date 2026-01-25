import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const TicketDetail = () => {
    const { id } = useParams();
    const [report, setReport] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:8080/ghost-api/tickets/${id}`)
            .then(res => res.json())
            .then(data => setReport(data))
            .catch(err => console.error(err));
    }, [id]);

    if (!report) return <div className="p-8">Loading Ticket Details...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <Link to="/dashboard/tickets" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-3">
                            Ticket Analysis
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                {report.persona}
                            </span>
                        </h1>
                        <p className="text-sm text-slate-500 font-mono">{report.id} • {new Date(report.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Visual Context Column */}
                <div className="lg:col-span-1 space-y-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Captured Context</h2>
                    {report.steps.map((step, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-xs font-bold text-slate-400">STEP {idx + 1}</span>
                                <div className="text-xs font-mono truncate text-slate-600 dark:text-slate-300" title={step.url}>{step.url}</div>
                                {step.capturedAt && (
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        {new Date(step.capturedAt).toLocaleTimeString()}
                                    </div>
                                )}
                            </div>

                            {/* Screenshot */}
                            <div className="relative group cursor-pointer">
                                {step.image ? (
                                    <img src={step.image} alt={`Step ${idx + 1}`} className="w-full h-auto object-cover" />
                                ) : (
                                    <div className="h-32 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">No Image</div>
                                )}
                            </div>

                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-900 dark:text-amber-100 border-t border-amber-100 dark:border-amber-900/20">
                                <span className="font-bold">Note:</span> {step.note}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Analysis Column */}
                <div className="lg:col-span-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">AI Diagnosis</h2>
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="prose prose-slate dark:prose-invert max-w-none">
                            <ReactMarkdown>{report.analysis}</ReactMarkdown>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TicketDetail;
