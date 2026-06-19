import React, { useEffect, useState } from 'react';
import apiService from '../services/ApiService';

/**
 * CampaignWizardModal — S22-1
 *
 * Creation modal for the advertiser persona.
 * - Retailer dropdown sourced exclusively from getRetailersForCampaign()
 *   (GET /api/retailers?for=campaign — status='active', deleted_at==null).
 *   Must NOT call getRetailers() here (S21-5, GUARDRAIL-15).
 * - advertiser_id is NOT sent — backend stamps it from JWT (campaigns.js POST).
 * - No hardcoded API URLs (GUARDRAIL-6).
 * - Date validation: start_date >= today AND start_date < end_date.
 * - Non-2xx errors displayed inline; submit button never silently disabled.
 * - On 201: calls props.onSuccess() → parent refetches campaign list.
 */

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL = {
    name: '',
    description: '',
    retailer_id: '',
    budget: '',
    start_date: '',
    end_date: '',
    creative_url: '',
};

export default function CampaignWizardModal({ onSuccess, onClose }) {
    const [form, setForm] = useState(INITIAL);
    const [errors, setErrors] = useState({});
    const [submitting, setSub] = useState(false);
    const [serverErr, setSrvErr] = useState(null);

    // Retailer dropdown state
    const [retailers, setRetailers] = useState([]);
    const [retailersLoading, setRetLoad] = useState(true);
    const [retailersError, setRetErr] = useState(null);

    // Load active retailers on mount — getRetailersForCampaign() only (S21-5)
    useEffect(() => {
        apiService.getRetailersForCampaign()
            .then(res => setRetailers(res.data ?? res))
            .catch(err => setRetErr(err?.response?.data?.error ?? err.message))
            .finally(() => setRetLoad(false));
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleChange = (key, value) => {
        setForm(f => ({ ...f, [key]: value }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = 'Campaign name is required.';
        if (!form.retailer_id) e.retailer_id = 'Please select a retailer.';
        if (!form.start_date) e.start_date = 'Start date is required.';
        if (!form.end_date) e.end_date = 'End date is required.';
        if (form.start_date && form.start_date < today())
            e.start_date = 'Start date must be today or in the future.';
        if (form.start_date && form.end_date && form.end_date <= form.start_date)
            e.end_date = 'End date must be after start date.';
        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setSub(true);
        setSrvErr(null);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                retailer_id: form.retailer_id,
                budget: form.budget ? Number(form.budget) : undefined,
                start_date: form.start_date,
                end_date: form.end_date,
                creative_url: form.creative_url.trim() || undefined,
            };
            // Strip undefined keys — don't persist nulls for omitted optional fields
            Object.keys(payload).forEach(k => {
                if (payload[k] === undefined) delete payload[k];
            });
            await apiService.createCampaign(payload);
            onSuccess();
        } catch (err) {
            setSrvErr(err?.response?.data?.error ?? err.message);
        } finally {
            setSub(false);
        }
    };

    // Derive selected retailer name for list display (persisted via retailer_id)
    const selectedRetailerName = retailers.find(r => r.id === form.retailer_id)?.name ?? null;

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-title"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div data-testid="campaign-wizard-modal" className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">

                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 id="wizard-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                        New Campaign
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        data-testid="btn-modal-close" className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                    </button>
                </div>

                {/* Scrollable body */}
                <form onSubmit={handleSubmit} noValidate className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

                    {/* Server error banner */}
                    {serverErr && (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                            {serverErr}
                        </div>
                    )}

                    {/* Campaign Name */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="wiz-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Campaign Name <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="wiz-name"
                            type="text"
                            required
                            data-testid="wizard-input-name"
                            value={form.name}
                            onChange={e => handleChange('name', e.target.value)}
                            placeholder="Summer Sale 2026"
                            aria-invalid={!!errors.name}
                            aria-describedby={errors.name ? 'err-name' : undefined}
                            className={`rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.name ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                                }`}
                        />
                        {errors.name && (
                            <p id="err-name" role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.name}</p>
                        )}
                    </div>

                    {/* Retailer dropdown — getRetailersForCampaign() only (S21-5, GUARDRAIL-15) */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="wiz-retailer" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Retailer <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        {retailersLoading ? (
                            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ) : retailersError ? (
                            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                                Could not load retailers: {retailersError}
                            </p>
                        ) : (
                            <select
                                id="wiz-retailer"
                                required
                                data-testid="wizard-select-retailer"
                                value={form.retailer_id}
                                onChange={e => handleChange('retailer_id', e.target.value)}
                                aria-invalid={!!errors.retailer_id}
                                aria-describedby={errors.retailer_id ? 'err-retailer' : undefined}
                                className={`rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.retailer_id ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                                    }`}
                            >
                                <option value="">
                                    {retailers.length === 0
                                        ? 'No active retailers available.'
                                        : '— Select a retailer —'}
                                </option>
                                {retailers.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        )}
                        {errors.retailer_id && (
                            <p id="err-retailer" role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.retailer_id}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="wiz-desc" className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                        <textarea
                            id="wiz-desc"
                            rows={2}
                            data-testid="wizard-input-desc"
                            value={form.description}
                            onChange={e => handleChange('description', e.target.value)}
                            placeholder="Brief description of the campaign…"
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                        />
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="wiz-start" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Start Date <span className="text-red-500" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="wiz-start"
                                type="date"
                                required
                                data-testid="wizard-input-start-date"
                                min={today()}
                                value={form.start_date}
                                onChange={e => handleChange('start_date', e.target.value)}
                                aria-invalid={!!errors.start_date}
                                aria-describedby={errors.start_date ? 'err-start' : undefined}
                                className={`rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.start_date ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                                    }`}
                            />
                            {errors.start_date && (
                                <p id="err-start" role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.start_date}</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="wiz-end" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                End Date <span className="text-red-500" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="wiz-end"
                                type="date"
                                required
                                data-testid="wizard-input-end-date"
                                min={form.start_date || today()}
                                value={form.end_date}
                                onChange={e => handleChange('end_date', e.target.value)}
                                aria-invalid={!!errors.end_date}
                                aria-describedby={errors.end_date ? 'err-end' : undefined}
                                className={`rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.end_date ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                                    }`}
                            />
                            {errors.end_date && (
                                <p id="err-end" role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.end_date}</p>
                            )}
                        </div>
                    </div>

                    {/* Budget */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="wiz-budget" className="text-sm font-medium text-slate-700 dark:text-slate-300">Budget (USD)</label>
                        <input
                            id="wiz-budget"
                            type="number"
                            min="0"
                            data-testid="wizard-input-budget"
                            value={form.budget}
                            onChange={e => handleChange('budget', e.target.value)}
                            placeholder="5000"
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                    </div>

                    {/* Creative URL */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="wiz-creative" className="text-sm font-medium text-slate-700 dark:text-slate-300">Creative URL</label>
                        <input
                            id="wiz-creative"
                            type="url"
                            data-testid="wizard-input-creative"
                            value={form.creative_url}
                            onChange={e => handleChange('creative_url', e.target.value)}
                            placeholder="https://cdn.example.com/ad.mp4"
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                    </div>

                </form>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="campaign-wizard-form"
                        data-testid="wizard-btn-submit"
                        disabled={submitting || retailersLoading}
                        onClick={handleSubmit}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {submitting ? (
                            <><span className="animate-spin material-symbols-outlined text-[16px]" aria-hidden="true">progress_activity</span> Submitting…</>
                        ) : (
                            <><span className="material-symbols-outlined text-[16px]" aria-hidden="true">send</span> Submit for Approval</>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
