/**
 * AuditLogViewer.jsx — Sprint 7 token pass
 * Token-based styles, alternating row stripes, filter input atom, tabular-nums on timestamps/IDs.
 */
import { useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import '../../design-tokens.css';

const API = import.meta.env.VITE_API_URL || '';
function authHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
}

const ENTITY_TYPES = ['campaign','screen','user','ad','schedule','loop','playlist','asset','store','retailer','advertiser'];

function actionColors(action = '') {
    if (action.includes('deleted') || action.includes('removed'))
        return { bg: 'var(--color-error-light)',   color: 'var(--color-error)' };
    if (action.includes('created') || action.includes('added'))
        return { bg: 'var(--color-success-light)', color: 'var(--color-success)' };
    if (action.includes('updated') || action.includes('changed'))
        return { bg: '#fef3c7', color: '#92400e' };
    return { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' };
}

const inputStyle = {
    padding: '6px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    backgroundColor: 'var(--color-bg-card)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    fontFamily: 'var(--font-body)',
};

function FilterBar({ filters, onChange, onSearch }) {
    return (
        <form
            onSubmit={e => { e.preventDefault(); onSearch(); }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}
        >
            <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', display: 'flex', pointerEvents: 'none' }}>
                    <Search size={13} />
                </span>
                <input
                    type="text" placeholder="Action (e.g. campaign.created)"
                    value={filters.action} onChange={e => onChange('action', e.target.value)}
                    style={{ ...inputStyle, paddingLeft: 28, width: 220 }}
                />
            </div>
            <select
                value={filters.entity_type} onChange={e => onChange('entity_type', e.target.value)}
                style={{ ...inputStyle, paddingRight: 28 }}
            >
                <option value="">All entities</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
                type="text" placeholder="Actor user ID"
                value={filters.actor_id} onChange={e => onChange('actor_id', e.target.value)}
                style={{ ...inputStyle, width: 160 }}
            />
            <input type="date" value={filters.from} onChange={e => onChange('from', e.target.value)} style={inputStyle} />
            <input type="date" value={filters.to}   onChange={e => onChange('to',   e.target.value)} style={inputStyle} />
            <button
                type="submit"
                style={{
                    padding: '6px 16px',
                    backgroundColor: 'var(--color-primary)', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}
            >Search</button>
        </form>
    );
}

function AuditRow({ log, stripe }) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = log.details && Object.keys(log.details).length > 0;
    const { bg, color } = actionColors(log.action);

    return (
        <>
            <tr
                onClick={() => hasDetails && setExpanded(e => !e)}
                style={{
                    backgroundColor: stripe ? 'var(--color-bg-hover)' : 'transparent',
                    cursor: hasDetails ? 'pointer' : 'default',
                    transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = stripe ? 'var(--color-bg-hover)' : 'transparent'; }}
            >
                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(log.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                    <span style={{
                        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        backgroundColor: bg, color,
                    }}>{log.action}</span>
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{log.entity_type}</td>
                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'monospace', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {log.entity_id || '—'}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.actor_email || log.actor_id}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-4)', width: 28, textAlign: 'center' }}>
                    {hasDetails && (
                        <span style={{ color: 'var(--color-text-tertiary)', display: 'flex', justifyContent: 'center' }}>
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </span>
                    )}
                </td>
            </tr>
            {expanded && hasDetails && (
                <tr style={{ backgroundColor: 'var(--color-bg-hover)' }}>
                    <td colSpan={6} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <pre style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', overflowX: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>
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
    const [logs, setLogs]         = useState([]);
    const [cursor, setCursor]     = useState(null);
    const [hasMore, setHasMore]   = useState(false);
    const [loading, setLoading]   = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError]       = useState(null);

    const buildUrl = useCallback((after = null) => {
        const p = new URLSearchParams({ limit: '50' });
        if (filters.action)      p.set('action',      filters.action.trim());
        if (filters.entity_type) p.set('entity_type', filters.entity_type);
        if (filters.actor_id)    p.set('actor_id',    filters.actor_id.trim());
        if (filters.from)        p.set('from',        filters.from);
        if (filters.to)          p.set('to',          filters.to);
        if (after)               p.set('after',       after);
        return `${API}/api/audit?${p.toString()}`;
    }, [filters]);

    const doSearch = useCallback(async (append = false) => {
        setLoading(true); setError(null);
        try {
            const res  = await fetch(buildUrl(append ? cursor : null), { headers: authHeaders() });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            setLogs(prev => append ? [...prev, ...(data.logs || [])] : (data.logs || []));
            setHasMore(data.hasMore || false);
            setCursor(data.nextCursor || null);
            setSearched(true);
        } catch (e) { setError('Failed to load audit logs: ' + e.message); }
        finally { setLoading(false); }
    }, [buildUrl, cursor]);

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>

            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Audit Log</h1>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>All system events across all entities.</p>
            </div>

            <FilterBar filters={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onSearch={() => doSearch(false)} />

            {error && (
                <div style={{
                    padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
                    backgroundColor: 'var(--color-error-light)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-error)',
                }}>{error}</div>
            )}

            <div style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-hover)' }}>
                                {['Timestamp','Action','Entity','Entity ID','Actor',''].map((h, i) => (
                                    <th key={i} style={{
                                        padding: 'var(--space-2) var(--space-4)',
                                        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)',
                                        textTransform: 'uppercase', letterSpacing: '0.07em',
                                        color: 'var(--color-text-tertiary)',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !logs.length ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} style={{ backgroundColor: i % 2 === 1 ? 'var(--color-bg-hover)' : 'transparent' }}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} style={{ padding: 'var(--space-2-5) var(--space-4)' }}>
                                                <div style={{ height: 12, borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-border)', width: `${55 + j * 7}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                                        {searched ? 'No logs match your filters.' : 'Use the filters above and press Search.'}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, idx) => <AuditRow key={log.id} log={log} stripe={idx % 2 === 1} />)
                            )}
                        </tbody>
                    </table>
                </div>

                {hasMore && (
                    <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
                        <button
                            onClick={() => doSearch(true)} disabled={loading}
                            style={{
                                fontSize: 'var(--text-sm)', color: 'var(--color-primary)',
                                background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1, fontFamily: 'var(--font-body)',
                            }}
                        >{loading ? 'Loading…' : 'Load more'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
