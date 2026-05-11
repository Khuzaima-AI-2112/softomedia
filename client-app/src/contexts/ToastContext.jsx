import React, { createContext, useContext, useState, useEffect } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const success = (message) => addToast(message, 'success');
    const error = (message) => addToast(message, 'error');
    const info = (message) => addToast(message, 'info');
    const warning = (message) => addToast(message, 'warning');

    return (
        <ToastContext.Provider value={{ success, error, info, warning }}>
            {children}

            {/* Toast Container */}
            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
            }}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            backgroundColor: toast.type === 'success' ? '#10b981' :
                                toast.type === 'error' ? '#ef4444' :
                                    toast.type === 'warning' ? '#f59e0b' :
                                        '#3b82f6',
                            color: 'white',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minWidth: '250px',
                            maxWidth: '400px',
                            animation: 'slideIn 0.3s ease-out',
                        }}
                    >
                        <span style={{ flex: 1 }}>{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '18px',
                                padding: '0',
                                lineHeight: '1',
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
}
