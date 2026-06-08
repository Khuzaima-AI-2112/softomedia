import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/ApiService';

/**
 * AdvertiserNewCampaign — S14-3
 * Campaign creation form for the advertiser persona.
 * Calls POST /api/campaigns — back end stamps advertiser_id from JWT
 * (linked_entity_id) and defaults status to 'pending_approval'.
 */

const INITIAL = {
    name:         '',
    description:  '',
    budget:       '',
    start_date:   '',
    end_date:     '',
    creative_url: '',
};

const FIELDS = [
    { key: 'name',         label: 'Campaign Name',  type: 'text',     required: true,  placeholder: 'Summer Sale 2026' },
    { key: 'description',  label: 'Description',    type: 'textarea', required: false, placeholder: 'Brief description of the campaign…' },
    { key: 'budget',       label: 'Budget (USD)',    type: 'number',   required: false, placeholder: '5000' },
    { key: 'start_date',   label: 'Start Date',      type: 'date',     required: false, placeholder: '' },
    { key: 'end_date',     label: 'End Date',        type: 'date',     required: false, placeholder: '' },
    { key: 'creative_url', label: 'Creative URL',    type: 'url',      required: false, placeholder: 'https://cdn.example.com/ad.mp4' },
];

export default function AdvertiserNewCampaign() {
    const { user } = useAuth();
    const navigate  = useNavigate();
    const [form, setForm]       = useState(INITIAL);
    const [errors, setErrors]   = useState({});
    const [submitting, setSub]  = useState(false);
    const [serverErr, setSrvErr] = useState(null);

    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = 'Campaign name is required.';
        if (form.start_date && form.end_date && form.end_date < form.start_date)
            e.end_date = 'End date must be on or after start date.';
        return e;
    };

    const handleChange = (key, value) => {
        setForm(f => ({ ...f, [key]: value }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setSub(true);
        setSrvErr(null);
        try {
            const payload = {
                ...form,
                budget: form.budget ? Number(form.budget) : undefined,
            };
            // Remove empty optional fields so the API doesn't persist nulls
            Object.keys(payload).forEach(k => {
                if (payload[k] === '' || payload[k] === undefined) delete payload[k];
            });
            await apiService.createCampaign(payload);
            navigate('/dashboard/advertiser/campaigns');
        } catch (err) {
            setSrvErr(err?.response?.data?.error ?? err.message);
        } finally {
            setSub(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Campaign</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Your campaign will be submitted for approval before going live.
                </p>
            </div>

            {serverErr && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {serverErr}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-sm">
                {FIELDS.map(({ key, label, type, required, placeholder }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                        <label
                            htmlFor={`field-${key}`}
                            className="text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                            {label}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
                        </label>

                        {type === 'textarea' ? (
                            <textarea
                                id={`field-${key}`}
                                rows={3}
                                value={form[key]}
                                onChange={e => handleChange(key, e.target.value)}
                                placeholder={placeholder}
                                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                            />
                        ) : (
                            <input
                                id={`field-${key}`}
                                type={type}
                                required={required}
                                value={form[key]}
                                onChange={e => handleChange(key, e.target.value)}
                                placeholder={placeholder}
                                aria-invalid={!!errors[key]}
                                aria-describedby={errors[key] ? `err-${key}` : undefined}
                                className={`rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${
                                    errors[key]
                                        ? 'border-red-400 dark:border-red-600'
                                        : 'border-slate-300 dark:border-slate-600'
                                }`}
                            />
                        )}

                        {errors[key] && (
                            <p id={`err-${key}`} role="alert" className="text-xs text-red-600 dark:text-red-400">
                                {errors[key]}
                            </p>
                        )}
                    </div>
                ))}

                <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard/advertiser/campaigns')}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {submitting ? (
                            <><span className="animate-spin material-symbols-outlined text-[16px]" aria-hidden="true">progress_activity</span> Submitting…</>
                        ) : (
                            <><span className="material-symbols-outlined text-[16px]" aria-hidden="true">send</span> Submit for Approval</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
