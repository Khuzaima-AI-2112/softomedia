import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import AILogAnalytics from '../../components/AILogAnalytics';
import { API_URL } from '../../config';

const PERSONAS = [
    { value: 'all', label: 'All Personas' },
    { value: 'CRM_buyer_persona', label: 'Buyer' },
    { value: 'software_tester_persona', label: 'Tester' }
];

function AILog() {
    const [logs, setLogs] = useState([]);
    const [totals, setTotals] = useState({ totalCost: 0, totalTokens: 0, totalConversations: 0 });
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [expandedLog, setExpandedLog] = useState(null);
    const [expandedDetails, setExpandedDetails] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        minRating: '',
        maxRating: '',
        persona: 'all'
    });

    useEffect(() => {
        loadLogs();
    }, [pagination.page, filters]);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });

            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.minRating) params.append('minRating', filters.minRating);
            if (filters.maxRating) params.append('maxRating', filters.maxRating);
            if (filters.persona !== 'all') params.append('persona', filters.persona);

            const response = await fetch(`${API_URL}/ghost-api/admin/logs?${params}`);
            if (!response.ok) throw new Error('Failed to fetch logs');

            const data = await response.json();
            setLogs(data.logs);
            setTotals(data.totals);
            setPagination(prev => ({ ...prev, ...data.pagination }));
        } catch (error) {
            console.error('Failed to load AI logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLogDetails = async (logId) => {
        if (expandedLog === logId) {
            setExpandedLog(null);
            setExpandedDetails(null);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/ghost-api/tickets/${logId}`);
            if (!response.ok) throw new Error('Failed to fetch details');

            const data = await response.json();
            setExpandedLog(logId);
            setExpandedDetails(data);
        } catch (error) {
            console.error('Failed to load log details:', error);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1
    };

    const clearFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            minRating: '',
            maxRating: '',
            persona: 'all'
        });
    };

    const exportCSV = () => {
        const headers = ['ID', 'Timestamp', 'Persona', 'Messages', 'Rating', 'Feedback', 'Cost', 'Input Tokens', 'Output Tokens'];
        const rows = logs.map(log => [
            log.id,
            new Date(log.timestamp).toLocaleString(),
            log.persona,
            log.messageCount,
            log.rating || 'N/A',
            log.ratingFeedback || '',
            `$${log.cost.toFixed(4)}`,
            log.tokenUsage?.input || 0,
            log.tokenUsage?.output || 0
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderStars = (rating) => {
        if (!rating) return <span className="text-slate-400 text-xs">Not rated</span>;
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                    <span
                        key={star}
                        className={`material-symbols-outlined text-sm ${star <= rating ? 'text-amber-400' : 'text-slate-300'}`}
                        style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
                    >
                        star
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">psychology</span>
                        AI Log
                    </h1>
                    <p className="text-slate-500 mt-1">Monitor all Ask Gemini interactions and costs</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAnalytics(!showAnalytics)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                            showAnalytics
                                ? 'bg-primary text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">analytics</span>
                        Analytics
                    </button>
                    <button
                        onClick={exportCSV}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Analytics Panel */}
            {showAnalytics && <AILogAnalytics />}

            {/* Cost Summary Bar */}
            <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Cost</p>
                            <p className="text-2xl font-bold text-primary">${totals.totalCost.toFixed(4)}</p>
                        </div>
                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Conversations</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totals.totalConversations}</p>
                        </div>
                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Tokens</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totals.totalTokens.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="text-xs text-slate-400">
                        Showing filtered results
                    </div>
                </div>
            </GlassCard>

            {/* Filters */}
            <GlassCard className="p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Min Rating</label>
                        <select
                            value={filters.minRating}
                            onChange={(e) => handleFilterChange('minRating', e.target.value)}
                            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                        >
                            <option value="">Any</option>
                            {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>{n}+ stars</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Persona</label>
                        <select
                            value={filters.persona}
                            onChange={(e) => handleFilterChange('persona', e.target.value)}
                            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                        >
                            {PERSONAS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={clearFilters}
                        className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        Clear filters
                    </button>
                </div>
            </GlassCard>

            {/* Logs Table */}
            <GlassCard className="overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                        <p>No AI logs found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Persona</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Steps</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rating</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tokens</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {logs.map(log => (
                                    <>
                                        <tr
                                            key={log.id}
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${expandedLog === log.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            onClick={() => loadLogDetails(log.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">{formatDate(log.timestamp)}</div>
                                                <div className="text-xs text-slate-400 font-mono">{log.id.slice(0, 20)}...</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                    log.persona === 'CRM_buyer_persona'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                }`}>
                                                    {log.persona === 'CRM_buyer_persona' ? 'Buyer' : 'Tester'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-slate-700 dark:text-slate-300">{log.messageCount}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderStars(log.rating)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-mono text-slate-900 dark:text-white">${log.cost.toFixed(4)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm text-slate-500">{log.tokenUsage?.total?.toLocaleString() || 0}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`material-symbols-outlined text-slate-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}>
                                                    expand_more
                                                </span>
                                            </td>
                                        </tr>
                                        {/* Expanded Details Row */}
                                        {expandedLog === log.id && expandedDetails && (
                                            <tr key={`${log.id}-details`}>
                                                <td colSpan="7" className="px-4 py-4 bg-slate-50 dark:bg-slate-800/30">
                                                    <div className="space-y-4">
                                                        {/* Steps */}
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">User Steps</h4>
                                                            <div className="grid gap-2">
                                                                {expandedDetails.steps?.map((step, idx) => (
                                                                    <div key={idx} className="flex gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                        {step.image && (
                                                                            <img
                                                                                src={step.image}
                                                                                alt={`Step ${idx + 1}`}
                                                                                className="w-24 h-16 object-cover rounded border"
                                                                            />
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-xs text-slate-400 font-mono">{step.url}</div>
                                                                            <div className="text-sm text-slate-700 dark:text-slate-300">{step.note}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* AI Response */}
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">AI Response</h4>
                                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 prose prose-sm dark:prose-invert max-w-none">
                                                                <pre className="whitespace-pre-wrap text-xs">{expandedDetails.analysis}</pre>
                                                            </div>
                                                        </div>

                                                        {/* Rating Feedback */}
                                                        {expandedDetails.ratingFeedback && (
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">User Feedback</h4>
                                                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                                                                    "{expandedDetails.ratingFeedback}"
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Token Breakdown */}
                                                        <div className="flex gap-6 text-xs text-slate-500">
                                                            <span>Input: {expandedDetails.tokenUsage?.input?.toLocaleString() || 0} tokens</span>
                                                            <span>Output: {expandedDetails.tokenUsage?.output?.toLocaleString() || 0} tokens</span>
                                                            <span>Rated: {expandedDetails.ratedAt ? formatDate(expandedDetails.ratedAt) : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-sm text-slate-500">
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page <= 1}
                                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page >= pagination.totalPages}
                                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}

export default AILog;
