import React, { useEffect, useState } from 'react';
import apiService from '../../services/ApiService';

/**
 * PricingConfig — S15-3
 * Admin page for viewing and updating CPM pricing configuration.
 * Route: /dashboard/admin/pricing-config
 */
export default function PricingConfig() {
    const [config,  setConfig]  = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const [error,   setError]   = useState(null);
    const [success, setSuccess] = useState(false);

    // Editable allocation fields
    const [paid,     setPaid]     = useState(0);
    const [retailer, setRetailer] = useState(0);
    const [internal, setInternal] = useState(0);

    // Editable CPM rates keyed by screen type
    const [cpmRates, setCpmRates] = useState({});

    const allocationSum = Number(paid) + Number(retailer) + Number(internal);
    const allocationValid = allocationSum === 100;

    useEffect(() => {
        setLoading(true);
        apiService.getPricingConfig()
            .then(cfg => {
                setConfig(cfg);
                setPaid(cfg?.allocation?.paid         ?? 0);
                setRetailer(cfg?.allocation?.retailer ?? 0);
                setInternal(cfg?.allocation?.internal ?? 0);
                setCpmRates(cfg?.cpm_rates ?? {});
            })
            .catch(err => setError(err?.response?.data?.error ?? err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleCpmRateChange = (screenType, value) => {
        setCpmRates(prev => ({ ...prev, [screenType]: parseFloat(value) || 0 }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!allocationValid) return;

        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const updated = await apiService.updatePricingConfig({
                cpm_rates:  cpmRates,
                allocation: {
                    paid:     Number(paid),
                    retailer: Number(retailer),
                    internal: Number(internal),
                },
            });
            setConfig(updated);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err?.response?.data?.error ?? err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse" aria-label="Loading pricing configuration">
                <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-700" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pricing Configuration</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage CPM rates and slot allocation across campaign types.
                </p>
            </div>

            <form
                data-testid="pricing-config-form"
                onSubmit={handleSubmit}
                className="space-y-8"
            >
                {/* CPM Rates */}
                {Object.keys(cpmRates).length > 0 && (
                    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
                        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">CPM Rates by Screen Type</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(cpmRates).map(([screenType, rate]) => (
                                <label key={screenType} className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        {screenType}
                                    </span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={rate}
                                            onChange={e => handleCpmRateChange(screenType, e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>
                )}

                {/* Slot Allocation */}
                <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Slot Allocation</h2>
                        <span
                            className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-full ${
                                allocationValid
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                        >
                            {allocationSum} / 100
                        </span>
                    </div>
                    <p className="text-xs text-slate-500">Percentages must sum to exactly 100.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Paid',     value: paid,     setter: setPaid },
                            { label: 'Retailer', value: retailer, setter: setRetailer },
                            { label: 'Internal', value: internal, setter: setInternal },
                        ].map(({ label, value, setter }) => (
                            <label key={label} className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={value}
                                        onChange={e => setter(e.target.value)}
                                        className="w-full pr-7 pl-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </section>

                {/* Feedback */}
                {error && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                {success && (
                    <p role="status" className="text-sm text-green-600 dark:text-green-400">Configuration saved successfully.</p>
                )}

                {/* Submit */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        data-testid="pricing-save-btn"
                        disabled={!allocationValid || saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? 'Saving…' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
}
