import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import apiService from '../../services/ApiService';
import {
    DEFAULT_STORE_TRAFFIC_TIERS,
    STORE_TIER_ORDER,
    UNASSIGNED_STORE_TIER,
} from '../../constants/storeTrafficTiers';

/**
 * PricingConfig — S15-3
 * Super Administrator page to view and update global CPM, slot allocation, and
 * the per-Store foot-traffic tiers.
 * Route: /dashboard/admin/pricing-config
 */

/** Shows what a tier does to the global CPM, so the effect is never implicit. */
function formatTierExample(baseCPM, multiplier) {
    if (!baseCPM || !multiplier) return '';
    return `$${baseCPM.toFixed(2)} → $${(baseCPM * multiplier).toFixed(2)} CPM`;
}

export default function PricingConfig() {
    const { user } = useAuth();

    const [config, setConfig] = useState(null);
    const [form, setForm] = useState(null);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user && user.role !== 'superadmin') return;
        Promise.all([apiService.getPricingConfig(), apiService.getStores()])
            .then(([data, storeList]) => {
                setConfig(data);
                setStores(Array.isArray(storeList) ? storeList : []);
                setForm({
                    baseCPM: data.baseCPM ?? 0,
                    allocation: {
                        paid: data.allocation?.paid ?? 70,
                        retailer: data.allocation?.retailer ?? 20,
                        internal: data.allocation?.internal ?? 10,
                    },
                    storeTrafficTiers: { ...DEFAULT_STORE_TRAFFIC_TIERS, ...(data.storeTrafficTiers ?? {}) },
                });
            })
            .catch(err => setError(err?.response?.data?.error ?? err.message))
            .finally(() => setLoading(false));
    }, [user]);

    // Role guard — platform governance belongs to the Super Administrator.
    if (user && user.role !== 'superadmin') {
        return <Navigate to="/dashboard" replace />;
    }

    const allocationSum = form
        ? (form.allocation.paid + form.allocation.retailer + form.allocation.internal)
        : 0;
    const allocationValid = allocationSum === 100;

    const handleCpmChange = (value) => {
        setForm(f => ({ ...f, baseCPM: parseFloat(value) || 0 }));
        setSuccess(false);
    };

    const handleAllocationChange = (key, value) => {
        setForm(f => ({ ...f, allocation: { ...f.allocation, [key]: parseInt(value) || 0 } }));
        setSuccess(false);
    };

    const handleStoreTierChange = (key, value) => {
        setForm(f => ({
            ...f,
            storeTrafficTiers: {
                ...f.storeTrafficTiers,
                [key]: { ...f.storeTrafficTiers[key], multiplier: parseFloat(value) || 0 },
            },
        }));
        setSuccess(false);
    };

    // A Store's tier saves on its own, not with the pricing form: it is a
    // property of the Store, not of the global configuration.
    const handleStoreTierAssign = async (storeId, value) => {
        const tier = value === '' ? null : value;
        setError(null);
        const previous = stores;
        setStores(current => current.map(store => (
            store.id === storeId ? { ...store, cpm_traffic_tier: tier } : store
        )));
        try {
            await apiService.updateStore(storeId, { cpm_traffic_tier: tier });
        } catch (err) {
            setStores(previous);
            setError(err?.response?.data?.error ?? err.message);
        }
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

    return (
        <div data-testid="pricing-config" className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pricing Configuration</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage the global CPM rate and campaign slot allocation.
                </p>
            </div>

            <form data-testid="modal-pricing-form" onSubmit={handleSubmit} className="space-y-8">

                {/* CPM Rates */}
                <div data-testid="pricing-tier" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        Global CPM Rate
                    </h2>
                    <div className="max-w-xs">
                        <label htmlFor="global-cpm" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">CPM</label>
                        <input id="global-cpm" data-testid="input-cpm-rate" type="number" step="0.01" min="0" value={form.baseCPM} onChange={e => handleCpmChange(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
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

                {/* Store Foot-Traffic Tiers */}
                <div data-testid="store-traffic-tiers" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Store Foot-Traffic Tiers
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                        Applied on top of the hour-of-day tier and any retailer CPM override, from each
                        Store&apos;s assigned traffic level. A Store with no tier assigned prices at 1.0x.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {STORE_TIER_ORDER.map(key => (
                            <div key={key}>
                                <label
                                    htmlFor={`store-tier-${key}`}
                                    className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                                >
                                    {form.storeTrafficTiers[key]?.label || key}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        id={`store-tier-${key}`}
                                        data-testid={`store-tier-multiplier-${key}`}
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="5"
                                        value={form.storeTrafficTiers[key]?.multiplier ?? 1}
                                        onChange={e => handleStoreTierChange(key, e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <span className="text-sm text-slate-400">×</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                    {formatTierExample(form.baseCPM, form.storeTrafficTiers[key]?.multiplier)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Per-Store tier assignment */}
                <div data-testid="store-tier-assignments" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Store Tier Assignment
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                        Each Store&apos;s foot-traffic tier. A Store with no tier assigned prices at 1.0×.
                        Changes apply to campaigns booked from that point forward and save immediately.
                    </p>
                    {stores.length === 0 ? (
                        <p className="text-sm text-slate-400">No Stores to assign.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {stores.map(store => (
                                <li key={store.id} className="flex items-center justify-between gap-4 py-3">
                                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                        {store.name || store.id}
                                    </span>
                                    <select
                                        aria-label={`Foot-traffic tier for ${store.name || store.id}`}
                                        data-testid={`store-tier-select-${store.id}`}
                                        value={store.cpm_traffic_tier || ''}
                                        onChange={e => handleStoreTierAssign(store.id, e.target.value)}
                                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="">{UNASSIGNED_STORE_TIER.label}</option>
                                        {STORE_TIER_ORDER.map(key => (
                                            <option key={key} value={key}>
                                                {form.storeTrafficTiers[key]?.label || key}
                                                {' '}({form.storeTrafficTiers[key]?.multiplier ?? 1}×)
                                            </option>
                                        ))}
                                    </select>
                                </li>
                            ))}
                        </ul>
                    )}
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
