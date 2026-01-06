import React from 'react';
import apiService from '../services/ApiService';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Send to Observability Service
        console.error("UI Error Caught:", error, errorInfo);
        apiService.reportError(error, errorInfo?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50">
                    <div className="size-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-4xl">error</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
                        The application encountered an unexpected error. Our systems have been notified.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-red-500/20"
                    >
                        Reload Application
                    </button>
                    {import.meta.env.MODE === 'development' && (
                        <pre className="mt-8 p-4 bg-slate-100 dark:bg-slate-900 rounded text-left text-xs overflow-auto max-w-full text-red-500">
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
