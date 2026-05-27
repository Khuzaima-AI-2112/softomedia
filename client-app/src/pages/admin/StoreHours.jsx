import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiService from '../../services/ApiService';
import GlassCard from '../../components/GlassCard';

const DEFAULT_WEEKLY_HOURS = {
  mon: { closed: true, open: '09:00', close: '17:00' },
  tue: { closed: true, open: '09:00', close: '17:00' },
  wed: { closed: true, open: '09:00', close: '17:00' },
  thu: { closed: true, open: '09:00', close: '17:00' },
  fri: { closed: true, open: '09:00', close: '17:00' },
  sat: { closed: true, open: '09:00', close: '13:00' },
  sun: { closed: true, open: '09:00', close: '13:00' },
};

const DAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function StoreHoursPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(searchParams.get('storeId') || '');
  const [weeklyHours, setWeeklyHours] = useState(DEFAULT_WEEKLY_HOURS);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingHours, setLoadingHours] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedStore = useMemo(
    () => stores.find((s) => String(s.id) === String(selectedStoreId)),
    [stores, selectedStoreId],
  );

  useEffect(() => {
    const loadStores = async () => {
      try {
        setLoadingStores(true);
        const res = await apiService.getStores();
        const list = Array.isArray(res?.data) ? res.data : res || [];
        setStores(list);

        // If no storeId in URL, preselect first store when available
        if (!selectedStoreId && list.length > 0) {
          const firstId = String(list[0].id);
          setSelectedStoreId(firstId);
          setSearchParams({ storeId: firstId });
        }
      } catch (e) {
        console.error('Failed to load stores for StoreHoursPage:', e);
        setError('Failed to load stores');
      } finally {
        setLoadingStores(false);
      }
    };

    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;

    const loadHours = async () => {
      try {
        setError('');
        setSuccess('');
        setLoadingHours(true);

        const res = await apiService.getWeeklyHours(selectedStoreId);
        const serverHours = res?.data?.weekly_hours || res?.data || {};

        setWeeklyHours({
          ...DEFAULT_WEEKLY_HOURS,
          ...serverHours,
        });
      } catch (e) {
        console.error('Failed to load weekly hours:', e);
        setWeeklyHours(DEFAULT_WEEKLY_HOURS);
        setError('Failed to load weekly hours; showing defaults.');
      } finally {
        setLoadingHours(false);
      }
    };

    loadHours();
  }, [selectedStoreId]);

  const handleStoreChange = (event) => {
    const value = event.target.value;
    setSelectedStoreId(value);
    setSearchParams(value ? { storeId: value } : {});
  };

  const updateDay = (dayKey, patch) => {
    setWeeklyHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedStoreId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiService.updateWeeklyHours(selectedStoreId, weeklyHours);
      setSuccess('Weekly hours saved successfully.');
    } catch (e) {
      console.error('Failed to save weekly hours:', e);
      setError('Failed to save weekly hours.');
    } finally {
      setSaving(false);
    }
  };

  const isBusy = loadingStores || loadingHours;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Store Hours</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Configure default weekly opening hours for each store. Special holiday hours can override these defaults.
          </p>
        </div>
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Select Store</label>
            <select
              className="w-full md:w-80 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary outline-none"
              value={selectedStoreId}
              onChange={handleStoreChange}
              disabled={loadingStores}
            >
              {loadingStores && <option>Loading stores...</option>}
              {!loadingStores && stores.length === 0 && <option>No stores available</option>}
              {!loadingStores && stores.length > 0 && <option value="">Select a store...</option>}
              {!loadingStores &&
                stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
            </select>
            {selectedStore && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                Managing hours for <span className="font-medium">{selectedStore.name}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedStoreId || saving || isBusy}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
            >
              {saving ? 'Saving...' : 'Save Weekly Hours'}
            </button>
          </div>
        </div>

        {(error || success) && (
          <div className="mt-2 text-sm">
            {error && <p className="text-rose-500">{error}</p>}
            {!error && success && <p className="text-emerald-500">{success}</p>}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Weekly schedule</h2>
          {isBusy && <p className="text-xs text-slate-500">Loading hours...</p>}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Object.entries(DAY_LABELS).map(([key, label]) => {
            const value = weeklyHours[key] || DEFAULT_WEEKLY_HOURS[key];
            const isClosed = value.closed;

            return (
              <div
                key={key}
                className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="w-32 flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {label}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-2 text-xs md:text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                      checked={!!isClosed}
                      onChange={(e) => updateDay(key, { closed: e.target.checked })}
                    />
                    Closed all day
                  </label>

                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <span className="text-slate-500">From</span>
                    <input
                      type="time"
                      value={value.open}
                      disabled={isClosed}
                      onChange={(e) => updateDay(key, { open: e.target.value })}
                      className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs md:text-sm focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="time"
                      value={value.close}
                      disabled={isClosed}
                      onChange={(e) => updateDay(key, { close: e.target.value })}
                      className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs md:text-sm focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

export default StoreHoursPage;
