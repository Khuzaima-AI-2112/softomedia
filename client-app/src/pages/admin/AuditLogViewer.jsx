/**
 * AuditLogViewer.jsx — Sprint 10
 *
 * Admin-only page for browsing audit_logs.
 * Features:
 *  - Filter bar: action text, entity_type dropdown, actor_id, date range
 *  - Cursor-paginated table (Load more)
 *  - Color-coded action badges
 *  - Expandable detail JSON viewer per row
 */

import { useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';
function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
}

const ENTITY_TYPES = ['', 'campaign', 'screen', 'user', 'ad', 'schedule', 'loop', 'playlist', 'asset', 'store', 'retailer', 'advertiser'];

const ACTION_COLOR = (action = '') => {
  if (action.includes('deleted') || action.includes('removed')) return 'bg-red-50 text-red-700';
  if (action.includes('created') || action.includes('added'))   return 'bg-green-50 text-green-700';
  if (action.includes('updated') || action.includes('changed')) return 'bg-amber-50 text-amber-700';
  return 'bg-gray-100 text-gray-600';
};

function FilterBar({ filters, onChange, onSearch }) {
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSearch(); }}
      className="flex flex-wrap gap-2 mb-5"
    >
      <input
        type="text"
        placeholder="Action (e.g. campaign.created)"
        value={filters.action}
        onChange={e => onChange('action', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 w-52"
      />
      <select
        value={filters.entity_type}
        onChange={e => onChange('entity_type', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="">All entities</option>
        {ENTITY_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input
        type="text"
        placeholder="Actor user ID"
        value={filters.actor_id}
        onChange={e => onChange('actor_id', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 w-44"
      />
      <input
        type="date"
        value={filters.from}
        onChange={e => onChange('from', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <input
        type="date"
        value={filters.to}
        onChange={e => onChange('to', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <button
        type="submit"
        className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}

function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <>
      <tr
        className={`hover:bg-gray-50 transition-colors ${
          hasDetails ? 'cursor-pointer' : ''
        }`}
        onClick={() => hasDetails && setExpanded(e => !e)}
      >
        <td className="py-2 pr-4 text-xs text-gray-400 whitespace-nowrap tabular-nums">
          {new Date(log.timestamp).toLocaleString()}
        </td>
        <td className="py-2 pr-4">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLOR(log.action)}`}>
            {log.action}
          </span>
        </td>
        <td className="py-2 pr-4 text-xs text-gray-600">{log.entity_type}</td>
        <td className="py-2 pr-4 text-xs text-gray-500 font-mono truncate max-w-[120px]">{log.entity_id || '—'}</td>
        <td className="py-2 pr-4 text-xs text-gray-500 truncate max-w-[160px]">{log.actor_email || log.actor_id}</td>
        <td className="py-2 text-xs text-gray-400">
          {hasDetails && (
            <span className="text-gray-300">{expanded ? '▲' : '▼'}</span>
          )}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-4 py-3">
            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogViewer() {
  const [filters, setFilters] = useState({ action: '', entity_type: '', actor_id: '', from: '', to: '' });
  const [logs, setLogs]       = useState([]);
  const [cursor, setCursor]   = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]     = useState(null);

  const buildUrl = useCallback((after = null) => {
    const params = new URLSearchParams({ limit: '50' });
    if (filters.action)      params.set('action',      filters.action.trim());
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.actor_id)    params.set('actor_id',    filters.actor_id.trim());
    if (filters.from)        params.set('from',        filters.from);
    if (filters.to)          params.set('to',          filters.to);
    if (after)               params.set('after',       after);
    return `${API}/api/audit?${params.toString()}`;
  }, [filters]);

  const doSearch = useCallback(async (append = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(append ? cursor : null);
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setLogs(prev => append ? [...prev, ...(data.logs || [])] : (data.logs || []));
      setHasMore(data.hasMore || false);
      setCursor(data.nextCursor || null);
      setSearched(true);
    } catch (e) {
      setError('Failed to load audit logs: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, cursor]);

  function handleFilterChange(key, val) {
    setFilters(prev => ({ ...prev, [key]: val }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All system events across all entities.</p>
        </div>

        <FilterBar filters={filters} onChange={handleFilterChange} onSearch={() => doSearch(false)} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Timestamp', 'Action', 'Entity', 'Entity ID', 'Actor', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-2 first:pl-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && !logs.length ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + j * 8}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                      {searched ? 'No logs match your filters.' : 'Use the filters above and press Search.'}
                    </td>
                  </tr>
                ) : (
                  logs.map(log => <AuditRow key={log.id} log={log} />)
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-4 py-3 border-t border-gray-100 text-center">
              <button
                onClick={() => doSearch(true)}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
