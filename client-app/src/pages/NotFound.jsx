import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import apiClient from '../services/api';

/**
 * NotFound — rendered by the App.jsx catch-all <Route path="*">.
 *
 * Two jobs:
 *  1. Show a clear, navigable 404 page so users are never stuck on
 *     a blank white screen.
 *  2. POST a broken_route entry to /api/ai-log so every unmatched
 *     path is captured and visible in Admin → AI Log. This makes
 *     broken internal links discoverable without needing error
 *     monitoring tooling.
 *
 * The log POST is fire-and-forget: if it fails (e.g. user is offline)
 * we silently swallow the error so the 404 UI still renders cleanly.
 */
function NotFound() {
    const location = useLocation();

    useEffect(() => {
        // Log the broken route to the AI log endpoint.
        // fire-and-forget — never let a failed log call break the UI.
        apiClient
            .post('/api/ai-log', {
                event_type: 'broken_route',
                prompt: `404: unmatched route visited — "${location.pathname}"`,
                response: null,
                metadata: {
                    path: location.pathname,
                    search: location.search,
                    referrer: document.referrer || null,
                    user_agent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                },
            })
            .catch(() => { /* intentionally silent */ });
    }, [location.pathname, location.search]);

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc',
                padding: '2rem',
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            {/* Large 404 */}
            <div
                style={{
                    fontSize: 'clamp(5rem, 20vw, 10rem)',
                    fontWeight: 900,
                    lineHeight: 1,
                    color: '#e2e8f0',
                    userSelect: 'none',
                    marginBottom: '1rem',
                }}
                aria-hidden="true"
            >
                404
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
                Page not found
            </h1>

            <p style={{ color: '#64748b', maxWidth: '36ch', marginBottom: '0.25rem' }}>
                The URL <code style={{ fontFamily: 'monospace', fontSize: '0.875rem', backgroundColor: '#f1f5f9', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>{location.pathname}</code> doesn't match any known route.
            </p>

            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>
                This has been logged and will appear in <strong>Admin → AI Log</strong>.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link
                    to="/dashboard/admin"
                    style={{
                        padding: '0.625rem 1.5rem',
                        backgroundColor: '#01696f',
                        color: 'white',
                        borderRadius: '0.5rem',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                    }}
                >
                    Go to Dashboard
                </Link>
                <button
                    onClick={() => window.history.back()}
                    style={{
                        padding: '0.625rem 1.5rem',
                        backgroundColor: 'white',
                        color: '#374151',
                        borderRadius: '0.5rem',
                        border: '1px solid #d1d5db',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                    }}
                >
                    Go Back
                </button>
            </div>
        </div>
    );
}

export default NotFound;
