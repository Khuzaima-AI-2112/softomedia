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
  const [specialHours, setSpecialHours] = useState({});
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingHours, setLoadingHours] = useState(false);
  const [loadingSpecial, setLoadingSpecial] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newDate, setNewDate] = useState('');
  const [newClosed, setNewClosed] = useState(false);
  const [newOpen, setNewOpen] = useState('09:00');
  const [newClose, setNewClose] = useState('17:00');

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

    const loadWeekly = async () => {
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

    const loadSpecial = async () => {
      try {
        setLoadingSpecial(true);
        const res = await apiService.listSpecialHours(selectedStoreId);
        const data = res?.data || {};
        setSpecialHours(data);
      } catch (e) {
        console.error('Failed to load special hours:', e);
        setSpecialHours({});
      } finally {
        setLoadingSpecial(false);
      }
    };

    loadWeekly();
    loadSpecial();
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

  const handleSaveWeekly = async () => {
    if (!selectedStoreId) return;
    setSavingWeekly(true);
    setError('');
    setSuccess('');
    try {
      await apiService.updateWeeklyHours(selectedStoreId, weeklyHours);
      setSuccess('Weekly hours saved successfully.');
    } catch (e) {
      console.error('Failed to save weekly hours:', e);
      setError('Failed to save weekly hours.');
    } finally {
      setSavingWeekly(false);
    }
  };

  const sortedSpecialEntries = useMemo(
    () =>
      Object.entries(specialHours).sort(([d1], [d2]) => d1.localeCompare(d2)),
    [specialHours],
  );

  const handleAddOrUpdateSpecial = async () => {
    if (!selectedStoreId || !newDate) return;

    setSavingSpecial(true);
    setError('');
    setSuccess('');

    const payload = {
      date: newDate,
      closed: newClosed,
      open: newOpen,
      close: newClose,
    };

    try {
      await apiService.updateSpecialHours(selectedStoreId, payload);
      setSpecialHours((prev) => ({
        ...prev,
        [newDate]: {
          closed: newClosed,
          open: newOpen,
          close: newClose,
        },
      }));
      setSuccess('Special hours saved.');
      setNewDate('');
      setNewClosed(false);
      setNewOpen('09:00');
      setNewClose('17:00');
    } catch (e) {
      console.error('Failed to save special hours:', e);
      setError('Failed to save special hours.');
    } finally {
      setSavingSpecial(false);
    }
  };

  const isBusy = loadingStores || loadingHours;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Store Hours</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Configure default weekly opening hours and special holiday hours for each store.
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
              onClick={handleSaveWeekly}
              disabled={!selectedStoreId || savingWeekly || isBusy}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
            >
              {savingWeekly ? 'Saving...' : 'Save Weekly Hours'}
            </button>
          </div>
        </div>

        {(error || success) and (
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

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Special hours</h2>
          {loadingSpecial && <p className="text-xs text-slate-500">Loading special dates...</p>}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs md:text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs md:text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newClosed}
                onChange={(e) => setNewClosed(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary"
              />
              Closed all day
            </label>

            <div className="flex items-center gap-2 text-xs md:text-sm">
              <span className="text-slate-500">From</span>
              <input
                type="time"
                value={newOpen}
                disabled={newClosed}
                onChange={(e) => setNewOpen(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs md:text-sm focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
              />
              <span className="text-slate-500">to</span>
              <input
                type="time"
                value={newClose}
                disabled={newClosed}
                onChange={(e) => setNewClose(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs md:text-sm focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
              />
            </div>

            <button
              type="button"
              onClick={handleAddOrUpdateSpecial}
              disabled={!selectedStoreId || !newDate || savingSpecial}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs md:text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              {savingSpecial ? 'Saving...' : 'Add / Update Date'}
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            {sortedSpecialEntries.length === 0 ? (
              <p className="text-xs text-slate-500">No special hours configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Closed</th>
                      <th className="py-2 pr-4 font-medium">Open</th>
                      <th className="py-2 pr-4 font-medium">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSpecialEntries.map(([date, conf]) => (
                      <tr key={date} className="border-b border-slate-50 dark:border-slate-900/40">
                        <td className="py-2 pr-4 align-middle text-slate-800 dark:text-slate-100">
                          {date}
                        </td>
                        <td className="py-2 pr-4 align-middle">
                          {conf.closed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-medium dark:bg-rose-900/30 dark:text-rose-200">
                              Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-medium dark:bg-emerald-900/30 dark:text-emerald-200">
                              Open
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 align-middle text-slate-700 dark:text-slate-200">
                          {conf.closed ? '—' : conf.open}
                        </td>
                        <td className="py-2 pr-4 align-middle text-slate-700 dark:text-slate-200">
                          {conf.closed ? '—' : conf.close}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default StoreHoursPage;
