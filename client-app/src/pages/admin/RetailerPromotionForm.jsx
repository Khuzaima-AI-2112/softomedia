import { useEffect, useState } from 'react';
import { X, CalendarClock } from 'lucide-react';
import apiService from '../../services/ApiService';
import { DAYPART_LABELS, DAYPART_NAMES, formatHour } from '../../constants/dayparts';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const today = () => new Date().toISOString().split('T')[0];

/** Every calendar date from start to end, inclusive, as YYYY-MM-DD. */
function datesBetween(start, end) {
    const dates = [];
    for (let day = new Date(`${start}T00:00:00Z`); day <= new Date(`${end}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
        dates.push(day.toISOString().slice(0, 10));
    }
    return dates;
}

const isOwnRetailerMedia = retailerId => asset => asset.category === 'retailer'
    && asset.owner_type === 'retailer'
    && asset.owner_id === retailerId;

/**
 * An Admin schedules a Retailer's promotion: its own media, on chosen dates,
 * in chosen Dayparts or hours. It plays only in that Retailer's positions.
 */
export default function RetailerPromotionForm({ onClose, onCreated }) {
    const [retailers, setRetailers] = useState([]);
    const [media, setMedia] = useState([]);
    const [dayparts, setDayparts] = useState(null);
    const [stores, setStores] = useState([]);
    const [form, setForm] = useState({
        name: '', retailer_id: '', store_id: '', media_id: '',
        start_date: today(), end_date: today(), dayparts: [], hours: [],
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([apiService.getRetailers(), apiService.getAssets(), apiService.getDayparts()])
            .then(([retailerList, assetList, daypartHours]) => {
                setRetailers(retailerList || []);
                setMedia(assetList || []);
                setDayparts(daypartHours);
            })
            .catch(err => setError(err.message));
    }, []);

    useEffect(() => {
        if (!form.retailer_id) return;
        apiService.getStores({ retailer_id: form.retailer_id })
            .then(storeList => setStores(storeList || []))
            .catch(err => setError(err.message));
    }, [form.retailer_id]);

    const setField = (field, value) => setForm(current => ({ ...current, [field]: value }));

    const chooseRetailer = (retailerId) => {
        setStores([]);
        setForm(current => ({ ...current, retailer_id: retailerId, store_id: '', media_id: '' }));
    };

    const toggle = (field, value) => setForm(current => ({
        ...current,
        [field]: current[field].includes(value)
            ? current[field].filter(item => item !== value)
            : [...current[field], value],
    }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        if (!form.name.trim()) return setError('Promotion name is required.');
        if (!form.retailer_id) return setError('Choose a Retailer.');
        if (!form.media_id) return setError('Choose the Retailer\'s media.');
        if (!form.start_date || !form.end_date || form.start_date > form.end_date) {
            return setError('Choose a start date on or before the end date.');
        }
        if (form.dayparts.length === 0 && form.hours.length === 0) {
            return setError('Choose at least one Daypart or hour.');
        }

        setSubmitting(true);
        try {
            const created = await apiService.createCampaign({
                type: 'retailer',
                name: form.name.trim(),
                retailer_id: form.retailer_id,
                ...(form.store_id ? { store_id: form.store_id } : {}),
                media_id: form.media_id,
                schedule: {
                    dates: datesBetween(form.start_date, form.end_date),
                    dayparts: DAYPART_NAMES.filter(name => form.dayparts.includes(name)),
                    hours: [...form.hours].sort((a, b) => a - b),
                },
            });
            onCreated(created);
        } catch (err) {
            setError(err.message || 'Failed to schedule the promotion.');
        } finally {
            setSubmitting(false);
        }
    };

    const retailerMedia = media.filter(isOwnRetailerMedia(form.retailer_id));
    const inputClass = 'w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors';
    const labelClass = 'block text-sm font-medium text-slate-300 mb-1';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-modal-title"
        >
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <h2 id="promotion-modal-title" className="text-lg font-bold text-white">Schedule Retailer Promotion</h2>
                    <button onClick={onClose} disabled={submitting} className="p-1 text-slate-400 hover:text-white" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">
                    {error && (
                        <div data-testid="promotion-form-error" className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className={labelClass} htmlFor="promotion-name">Promotion name</label>
                        <input
                            id="promotion-name" data-testid="promotion-name-input" type="text" className={inputClass}
                            value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Breakfast muffin upsell"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="promotion-retailer">Retailer</label>
                            <select
                                id="promotion-retailer" data-testid="promotion-retailer-select" className={inputClass}
                                value={form.retailer_id} onChange={e => chooseRetailer(e.target.value)}
                            >
                                <option value="">— Select Retailer —</option>
                                {retailers.map(retailer => (
                                    <option key={retailer.id} value={retailer.id}>{retailer.name || retailer.id}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="promotion-store">Stores</label>
                            <select
                                id="promotion-store" data-testid="promotion-store-select" className={inputClass}
                                value={form.store_id} onChange={e => setField('store_id', e.target.value)} disabled={!form.retailer_id}
                            >
                                <option value="">All of the Retailer&apos;s Stores</option>
                                {stores.map(store => (
                                    <option key={store.id} value={store.id}>{store.name || store.id}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="promotion-media">Retailer media</label>
                        <select
                            id="promotion-media" data-testid="promotion-media-select" className={inputClass}
                            value={form.media_id} onChange={e => setField('media_id', e.target.value)} disabled={!form.retailer_id}
                        >
                            <option value="">— Select media —</option>
                            {retailerMedia.map(asset => (
                                <option key={asset.id} value={asset.id}>{asset.title || asset.filename || asset.id}</option>
                            ))}
                        </select>
                        {form.retailer_id && retailerMedia.length === 0 && (
                            <p className="mt-1 text-xs text-amber-400">This Retailer has no media yet. Upload it in the Media Library first.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="promotion-start">First date</label>
                            <input
                                id="promotion-start" data-testid="promotion-start-date" type="date" className={inputClass}
                                value={form.start_date} onChange={e => setField('start_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="promotion-end">Last date</label>
                            <input
                                id="promotion-end" data-testid="promotion-end-date" type="date" className={inputClass}
                                value={form.end_date} onChange={e => setField('end_date', e.target.value)}
                            />
                        </div>
                    </div>

                    <fieldset>
                        <legend className={labelClass}>Dayparts</legend>
                        <div className="flex flex-wrap gap-3">
                            {dayparts && DAYPART_NAMES.map(name => (
                                <label key={name} className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox" data-testid={`promotion-daypart-${name}`}
                                        checked={form.dayparts.includes(name)} onChange={() => toggle('dayparts', name)}
                                    />
                                    <span>{`${DAYPART_LABELS[name]} (${formatHour(dayparts[name].start)}–${formatHour(dayparts[name].end)})`}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className={labelClass}>Or chosen hours</legend>
                        <div className="grid grid-cols-6 gap-2">
                            {HOURS.map(hour => (
                                <label key={hour} className="flex items-center gap-1 text-xs text-slate-300">
                                    <input
                                        type="checkbox" data-testid={`promotion-hour-${hour}`}
                                        checked={form.hours.includes(hour)} onChange={() => toggle('hours', hour)}
                                    />
                                    {formatHour(hour)}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <p className="text-xs text-slate-500">
                        The promotion plays only in this Retailer&apos;s own Slots, trimmed to each Store&apos;s opening hours,
                        once the Retailer approves it.
                    </p>

                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-700">
                        <button
                            type="button" onClick={onClose} disabled={submitting}
                            className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit" data-testid="promotion-submit-btn" disabled={submitting}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60"
                        >
                            <CalendarClock size={16} />
                            {submitting ? 'Scheduling…' : 'Schedule Promotion'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
