import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Toast — accessible, auto-dismissing notification chip.
 *
 * Props:
 *   id       {string|number}  Unique key.
 *   message  {string}         Text to display.
 *   type     {'success'|'error'|'warning'}  Visual variant (default 'success').
 *   duration {number}         Auto-dismiss ms (default 4000). 0 = no auto-dismiss.
 *   onDismiss {() => void}    Called when the toast should leave.
 */
function Toast({ message, type = 'success', duration = 4000, onDismiss }) {
    const timerRef = useRef(null);

    useEffect(() => {
        if (duration > 0) {
            timerRef.current = setTimeout(onDismiss, duration);
        }
        return () => clearTimeout(timerRef.current);
    }, [duration, onDismiss]);

    const base =
        'flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto max-w-sm w-full';

    const variants = {
        success: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700',
        error:   'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700',
        warning: 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700',
    };

    const icons = { success: 'check_circle', error: 'error', warning: 'warning' };

    return (
        <div role="status" aria-live="polite" aria-atomic="true" className={`${base} ${variants[type]}`}>
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5" aria-hidden="true">
                {icons[type]}
            </span>
            <span className="flex-1">{message}</span>
            <button
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            </button>
        </div>
    );
}

/**
 * ToastContainer — fixed region that stacks Toast instances.
 * Place once inside AdminLayout (or App root).
 *
 * Usage:
 *   const { toasts, addToast, removeToast } = useToasts();
 *   <ToastContainer toasts={toasts} onDismiss={removeToast} />
 */
export function ToastContainer({ toasts = [], onDismiss }) {
    if (toasts.length === 0) return null;
    return (
        <div
            aria-label="Notifications"
            className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        >
            {toasts.map(t => (
                <Toast key={t.id} {...t} onDismiss={() => onDismiss(t.id)} />
            ))}
        </div>
    );
}

/**
 * useToasts — state hook for managing a toast queue.
 *
 * Returns { toasts, addToast, removeToast }.
 *   addToast(message, type = 'success', duration = 4000)
 */
export function useToasts() {
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = ++counter.current;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
}

export default Toast;
