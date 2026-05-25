import { useState, useEffect } from 'react';

/**
 * NetworkErrorBanner
 * Listens for the `api:network-error` custom event emitted by api.js
 * when all retries are exhausted after a TypeError (Wi-Fi off / no connection).
 * Also listens to the browser's native online/offline events so the banner
 * dismisses automatically when connectivity is restored.
 */
function NetworkErrorBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const show = () => setVisible(true);
        const hide = () => setVisible(false);

        window.addEventListener('api:network-error', show);
        window.addEventListener('online', hide);

        return () => {
            window.removeEventListener('api:network-error', show);
            window.removeEventListener('online', hide);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            role="alert"
            aria-live="assertive"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                backgroundColor: '#fef2f2',
                borderBottom: '1px solid #fecaca',
                padding: '0.625rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                fontSize: '0.875rem',
                color: '#b91c1c',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                    wifi_off
                </span>
                <span>
                    <strong>Unable to connect</strong> — check your internet connection and try again.
                </span>
            </div>
            <button
                onClick={() => setVisible(false)}
                aria-label="Dismiss"
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#b91c1c',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '0.25rem',
                }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">close</span>
            </button>
        </div>
    );
}

export default NetworkErrorBanner;
