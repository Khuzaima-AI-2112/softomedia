import React, { useState, useEffect, createContext, useContext } from 'react';
import '../design-tokens.css';

/**
 * AlertSystem - State 9: Red Dot Alert (Offline Scenario)
 * Toast notification system for real-time alerts
 */

// Context for managing alerts globally
const AlertContext = createContext();

export const useAlerts = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlerts must be used within AlertProvider');
    }
    return context;
};

export function AlertProvider({ children }) {
    const [alerts, setAlerts] = useState([]);

    const addAlert = (alert) => {
        const id = Date.now() + Math.random();
        const newAlert = {
            id,
            type: alert.type || 'info',
            title: alert.title,
            message: alert.message,
            duration: alert.duration || 5000,
        };

        setAlerts(prev => [...prev, newAlert]);

        // Auto-dismiss
        if (newAlert.duration > 0) {
            setTimeout(() => {
                removeAlert(id);
            }, newAlert.duration);
        }

        return id;
    };

    const removeAlert = (id) => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
    };

    return (
        <AlertContext.Provider value={{ addAlert, removeAlert }}>
            {children}
            <AlertContainer alerts={alerts} onDismiss={removeAlert} />
        </AlertContext.Provider>
    );
}

function AlertContainer({ alerts, onDismiss }) {
    if (alerts.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 'var(--space-4)',
                right: 'var(--space-4)',
                zIndex: 'var(--z-toast)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                maxWidth: '400px',
            }}
        >
            {alerts.map(alert => (
                <Toast key={alert.id} alert={alert} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function Toast({ alert, onDismiss }) {
    const [exiting, setExiting] = useState(false);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => {
            onDismiss(alert.id);
        }, 300);
    };

    const typeConfig = {
        offline: {
            bg: 'var(--color-error-light)',
            border: 'var(--color-error)',
            icon: '🔴',
            iconBg: 'var(--color-error)',
        },
        warning: {
            bg: 'var(--color-warning-light)',
            border: 'var(--color-warning)',
            icon: '⚠️',
            iconBg: 'var(--color-warning)',
        },
        success: {
            bg: 'var(--color-success-light)',
            border: 'var(--color-success)',
            icon: '✅',
            iconBg: 'var(--color-success)',
        },
        info: {
            bg: '#e0e7ff',
            border: 'var(--color-primary)',
            icon: 'ℹ️',
            iconBg: 'var(--color-primary)',
        },
    };

    const config = typeConfig[alert.type] || typeConfig.info;

    return (
        <div
            style={{
                backgroundColor: 'white',
                borderLeft: `4px solid ${config.border}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xl)',
                padding: 'var(--space-4)',
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
                animation: exiting ? 'slideOutRight 0.3s ease-out' : 'slideInRight 0.3s ease-out',
                maxWidth: '100%',
            }}
        >
            {/* Icon */}
            <div
                style={{
                    fontSize: 'var(--text-xl)',
                    flexShrink: 0,
                }}
            >
                {config.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {alert.title && (
                    <div
                        style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-semibold)',
                            color: 'var(--color-text-primary)',
                            marginBottom: 'var(--space-1)',
                        }}
                    >
                        {alert.title}
                    </div>
                )}
                <div
                    style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.4,
                    }}
                >
                    {alert.message}
                </div>
            </div>

            {/* Close Button */}
            <button
                onClick={handleDismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--text-lg)',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    transition: 'color var(--transition-fast)',
                    flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
                aria-label="Dismiss"
            >
                ×
            </button>

            <style>{`
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
}

export default AlertSystem;
