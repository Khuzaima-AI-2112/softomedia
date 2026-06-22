import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import apiService from '../../services/ApiService';

/**
 * PricingConfig — S15-3
 * Admin-only page to view and update CPM rate config and slot allocation.
 * Route: /dashboard/admin/pricing-config
 */
export default function PricingConfig() {
    const { user } = useAuth();

    const [config, setConfig] = useState(null);
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user && user.role !== 'admin' && user.role !== 'superadmin') return;
        apiService.getPricingConfig()
            .then(data => {
                setConfig(data);
                setForm({
                    cpm_rates: { ...(data.cpm_rates ?? {}) },
                    allocation: {
                        paid: data.allocation?.paid ?? 100,
                        retailer: data.allocation?.retailer ?? 0,
                        internal: data.allocation?.internal ?? 0,
                    },
                });
            })
            .catch(err => setError(err?.response?.data?.error ?? err.message))
            .finally(() => setLoading(false));
    }, [user]);

    // Role guard — non-admin sees nothing
    if (user && user.role !== 'admin' && user.role !== 'superadmin') {
        return <Navigate to="/dashboard" replace />;
    }

    const allocationSum = form
        ? (form.allocation.paid + form.allocation.retailer + form.allocation.internal)
        : 0;
    const allocationValid = allocationSum === 100;

    const handleCpmChange = (key, value) => {
        setForm(f => ({ ...f, cpm_rates: { ...f.cpm_rates, [key]: parseFloat(value) || 0 } }));
        setSuccess(false);
    };

    const handleAllocationChange = (key, value) => {
        setForm(f => ({ ...f, allocation: { ...f.allocation, [key]: parseInt(value) || 0 } }));
        setSuccess(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!allocationValid) return;
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const updated = await apiService.updatePricingConfig(form);
            setConfig(updated);
            setSuccess(true);
        } catch (err) {
            setError(err?.response?.data?.error ?? err.message);
        } finally {
            setSaving(false);
        }
    };

    // ---- Skeleton ----
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
        );
    }

    const cpmKeys = form?.cpm_rates ? Object.keys(form.cpm_rates) : [];

    return (
        <div data-testid="pricing-config" className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pricing Configuration</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage CPM rates by screen type and campaign slot allocation.
                </p>
            </div>

            <form data-testid="modal-pricing-form" onSubmit={handleSubmit} className="space-y-8">

                {/* CPM Rates */}
                <div data-testid="pricing-tier" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        CPM Rates by Screen Type
                    </h2>
                    {cpmKeys.length === 0 ? (
                        <p className="text-sm text-slate-400">No screen type rates configured.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cpmKeys.map(key => (
                                <div key={key}>
                                    <label
                                        htmlFor={`cpm-${key}`}
                                        className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                                    >
                                        {key}
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-sm">$</span>
                                        <input
                                            id={`cpm-${key}`}
                                            data-testid="input-cpm-rate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.cpm_rates[key]}
                                            onChange={e => handleCpmChange(key, e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <span className="text-slate-400 text-xs whitespace-nowrap">/ 1 000</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Slot Allocation */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            Slot Allocation
                        </h2>
                        <span
                            className={`text-xs font-bold px-2 py-1 rounded-full ${allocationValid
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                }`}
                        >
                            Sum: {allocationSum} / 100
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                        Paid + Retailer + Internal must equal exactly 100.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {['paid', 'retailer', 'internal'].map(key => (
                            <div key={key}>
                                <label
                                    htmlFor={`alloc-${key}`}
                                    className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                                >
                                    {key}
                                </label>
                                <input
                                    id={`alloc-${key}`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={form.allocation[key]}
                                    onChange={e => handleAllocationChange(key, e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Feedback */}
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                {success && (
                    <p className="text-sm text-green-600 dark:text-green-400">Configuration saved successfully.</p>
                )}

                {/* Submit */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        data-testid="btn-pricing-form-submit"
                        disabled={!allocationValid || saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving…' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
}
