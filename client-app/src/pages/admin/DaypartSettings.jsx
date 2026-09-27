import { useEffect, useState } from 'react';
import apiService from '../../services/ApiService';
import { DAYPART_LABELS, DAYPART_NAMES, formatHour } from '../../constants/dayparts';

const HOUR_BOUNDARIES = Array.from({ length: 25 }, (_, hour) => hour);

/**
 * The network's Dayparts, set by the Super Administrator once for every Store.
 * Store opening hours trim them wherever they are used.
 */
export default function DaypartSettings() {
    const [dayparts, setDayparts] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiService.getDayparts()
            .then(setDayparts)
            .catch(err => setError(err.message));
    }, []);

    const handleChange = (name, bound, value) => {
        setDayparts(current => ({ ...current, [name]: { ...current[name], [bound]: Number(value) } }));
        setSaved(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            setDayparts(await apiService.updateDayparts(dayparts));
            setSaved(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            data-testid="daypart-settings"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dayparts</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Breakfast, lunch and dinner hours for the whole network. Each Store&apos;s opening hours trim them.
                </p>
            </div>

            {dayparts && (
                <div className="grid gap-3 sm:grid-cols-3">
                    {DAYPART_NAMES.map(name => (
                        <fieldset key={name} className="space-y-2">
                            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {DAYPART_LABELS[name]}
                            </legend>
                            <div className="flex items-center gap-2">
                                {['start', 'end'].map(bound => (
                                    <select
                                        key={bound}
                                        aria-label={`${DAYPART_LABELS[name]} ${bound === 'start' ? 'starts' : 'ends'}`}
                                        data-testid={`daypart-${name}-${bound}`}
                                        value={dayparts[name][bound]}
                                        onChange={e => handleChange(name, bound, e.target.value)}
                                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-sm"
                                    >
                                        {HOUR_BOUNDARIES.map(hour => (
                                            <option key={hour} value={hour}>{formatHour(hour)}</option>
                                        ))}
                                    </select>
                                ))}
                            </div>
                        </fieldset>
                    ))}
                </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {saved && <p className="text-sm text-green-600 dark:text-green-400">Dayparts saved.</p>}

            <div className="flex justify-end">
                <button
                    type="submit"
                    data-testid="btn-save-dayparts"
                    disabled={!dayparts || saving}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save Dayparts'}
                </button>
            </div>
        </form>
    );
}
