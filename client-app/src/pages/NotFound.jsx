import { useLocation, Link } from 'react-router-dom';

/**
 * NotFound — rendered by the App.jsx catch-all <Route path="*">.
 * Shows a clear, navigable 404 page so users are never stuck on a blank white screen.
 */
function NotFound() {
    const location = useLocation();

    return (
        <div
            data-testid="error-404"
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
                The URL <code style={{ fontFamily: 'monospace', fontSize: '0.875rem', backgroundColor: '#f1f5f9', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>{location.pathname}</code> doesn&apos;t match any known route.
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
