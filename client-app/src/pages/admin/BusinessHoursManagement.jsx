import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiService from '../../services/ApiService';

const DAYS = [
    { id: 0, name: 'Sunday' },
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' },
    { id: 6, name: 'Saturday' }
];

function BusinessHoursManagement() {
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [weeklyHours, setWeeklyHours] = useState([]);
    const [specialHours, setSpecialHours] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('weekly');

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showSpecialModal, setShowSpecialModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [specialFormData, setSpecialFormData] = useState({
        open_time: '09:00',
        close_time: '18:00',
        is_closed: false,
        reason: ''
    });

    useEffect(() => {
        loadStores();
    }, []);

    useEffect(() => {
        if (selectedStore) {
            loadStoreHours(selectedStore.id);
        }
    }, [selectedStore]);

    const loadStores = async () => {
        try {
            setLoading(true);
            const allStores = await apiService.getStores();
            setStores(allStores);
            if (allStores.length > 0) {
                setSelectedStore(allStores[0]);
            }
        } catch (error) {
            console.error('Failed to load stores:', error);
            // T5: Surface error to user instead of swallowing it silently
            setMessage({ type: 'error', text: 'Failed to load stores. Please refresh the page.' });
        } finally {
            setLoading(false);
        }
    };

    const loadStoreHours = async (storeId) => {
        try {
            const [weekly, special] = await Promise.all([
                apiService.getWeeklyHours(storeId),
                apiService.listSpecialHours(storeId)
            ]);

            // Fill in missing days for weekly
            const fullWeekly = DAYS.map(day => {
                const existing = weekly.find(w => parseInt(w.day_of_week) === day.id);
                return existing || {
                    day_of_week: day.id,
                    open_time: '09:00',
                    close_time: '18:00',
                    is_closed: false
                };
            }).sort((a, b) => a.day_of_week - b.day_of_week);

            setWeeklyHours(fullWeekly);
            setSpecialHours(special || []);
        } catch (error) {
            console.error('Failed to load store hours:', error);
            // T5: Surface error to user instead of swallowing it silently
            setMessage({ type: 'error', text: 'Failed to load schedule for this store. Please try again.' });
        }
    };

    const handleWeeklyUpdate = (dayIndex, field, value) => {
        const newHours = [...weeklyHours];
        newHours[dayIndex] = { ...newHours[dayIndex], [field]: value };
        setWeeklyHours(newHours);
    };

    const saveWeeklyHours = async () => {
        if (!selectedStore) return;
        try {
            setSaving(true);
            setMessage({ type: 'info', text: 'Saving weekly schedule...' });
            await apiService.updateWeeklyHours(selectedStore.id, weeklyHours);
            setMessage({ type: 'success', text: 'Weekly schedule saved successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDateClick = async (date) => {
        // Safe YYYY-MM-DD formatting in local time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        setSelectedDate(dateStr);

        // Find existing override if any
        const existing = specialHours.find(h => h.date === dateStr);
        if (existing) {
            setSpecialFormData({
                open_time: existing.open_time || '09:00',
                close_time: existing.close_time || '18:00',
                is_closed: existing.is_closed || false,
                reason: existing.reason || ''
            });
        } else {
            // Default based on weekly schedule for that day
            const dayOfWeek = date.getDay();
            const dayDefault = weeklyHours.find(w => parseInt(w.day_of_week) === dayOfWeek);
            setSpecialFormData({
                open_time: dayDefault?.open_time || '09:00',
                close_time: dayDefault?.close_time || '18:00',
                is_closed: dayDefault?.is_closed || false,
                reason: ''
            });
        }
        setShowSpecialModal(true);
    };

    const saveSpecialHours = async () => {
        if (!selectedStore || !selectedDate) return;
        try {
            setSaving(true);
            await apiService.updateSpecialHours(selectedStore.id, selectedDate, specialFormData);
            await loadStoreHours(selectedStore.id);
            setShowSpecialModal(false);
            setMessage({ type: 'success', text: `Special hours for ${selectedDate} updated!` });
        } catch (error) {
            setMessage({ type: 'error', text: `Failed to update special hours: ${error.message}` });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    // Calendar Helper Functions
    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const generateCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const days = [];

        // Previous month padding
        const prevMonthDays = daysInMonth(year, month - 1);
        const firstDay = firstDayOfMonth(year, month);
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthDays - i, month: month - 1, year, padding: true });
        }

        // Current month
        const count = daysInMonth(year, month);
        for (let i = 1; i <= count; i++) {
            days.push({ day: i, month, year, padding: false });
        }

        return days;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Business Hours
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Manage operational hours and holiday overrides for your retail network
                    </p>
                </div>
            </div>

            {/* T5: Page-level error shown outside the store selector so it's always visible */}
            {message && !selectedStore && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-700'
                    }`}>
                    <span className="material-symbols-outlined text-lg">
                        {message.type === 'error' ? 'error' : 'info'}
                    </span>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Store Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest px-2">Select Store</h3>
                    <div className="space-y-1">
                        {stores.map(store => (
                            <button
                                key={store.id}
                                onClick={() => setSelectedStore(store)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${selectedStore?.id === store.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                    : 'hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-xl">storefront</span>
                                <div>
                                    <p className="font-semibold text-sm leading-tight">{store.name}</p>
                                    <p className={`text-[10px] ${selectedStore?.id === store.id ? 'text-white/70' : 'text-slate-400'}`}>
                                        {store.city}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3 space-y-6">
                    {selectedStore && (
                        <>
                            {/* Tabs */}
                            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit mb-2">
                                <button
                                    onClick={() => setActiveTab('weekly')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'weekly'
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Standard Week
                                </button>
                                <button
                                    onClick={() => setActiveTab('overrides')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overrides'
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Future Overrides
                                </button>
                            </div>

                            {/* Success/Error Toast (Global) */}
                            {message && (
                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                                    message.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                        'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                    }`}>
                                    <span className="material-symbols-outlined text-lg">
                                        {message.type === 'success' ? 'check_circle' : message.type === 'error' ? 'error' : 'info'}
                                    </span>
                                    {message.text}
                                </div>
                            )}

                            {activeTab === 'weekly' && (
                                <GlassCard data-testid="business-hours-form" className="relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <span className="material-symbols-outlined text-primary">calendar_view_week</span>
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold">Weekly Schedule</h2>
                                                <p className="text-xs text-slate-500 uppercase font-medium tracking-wide">Standard Operational Hours</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={saveWeeklyHours}
                                            data-testid="btn-hours-save"
                                            disabled={saving}
                                            className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            {saving ? (
                                                <div className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full"></div>
                                            ) : (
                                                <span className="material-symbols-outlined text-lg">save</span>
                                            )}
                                            Save Changes
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {DAYS.map((day, idx) => {
                                            const hours = weeklyHours[idx] || {};
                                            return (
                                                <div
                                                    key={day.id}
                                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hours.is_closed
                                                        ? 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800'
                                                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm'
                                                        }`}
                                                >
                                                    <div className="w-32">
                                                        <p className={`font-bold ${hours.is_closed ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                                            {day.name}
                                                        </p>
                                                    </div>

                                                    <div className="flex-1 flex items-center gap-8 px-4">
                                                        {!hours.is_closed && (
                                                            <div className="flex items-center gap-4">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block">Open</label>
                                                                    <input
                                                                        type="time"
                                                                        value={hours.open_time}
                                                                        onChange={(e) => handleWeeklyUpdate(idx, 'open_time', e.target.value)}
                                                                        className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 outline-none"
                                                                    />
                                                                </div>
                                                                <span className="text-slate-300">→</span>
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block">Close</label>
                                                                    <input
                                                                        type="time"
                                                                        value={hours.close_time}
                                                                        onChange={(e) => handleWeeklyUpdate(idx, 'close_time', e.target.value)}
                                                                        className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                        {hours.is_closed && (
                                                            <div className="flex-1 h-[38px] flex items-center">
                                                                <span className="text-xs font-semibold px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-md">CLOSED ALL DAY</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                                            <span className="text-xs font-medium text-slate-500">Closed</span>
                                                            <div className="relative">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={hours.is_closed}
                                                                    onChange={(e) => handleWeeklyUpdate(idx, 'is_closed', e.target.checked)}
                                                                />
                                                                <div className={`w-10 h-5 rounded-full transition-colors ${hours.is_closed ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                                <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${hours.is_closed ? 'translate-x-5' : ''}`}></div>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </GlassCard>
                            )}

                            {activeTab === 'overrides' && (
                                <GlassCard className="relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                                <span className="material-symbols-outlined text-amber-500">calendar_month</span>
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold">Override Calendar</h2>
                                                <p className="text-xs text-slate-500 uppercase font-medium tracking-wide">Set Future Date Specific Hours</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined">chevron_left</span>
                                            </button>
                                            <span className="text-sm font-bold min-w-[120px] text-center">
                                                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                            </span>
                                            <button
                                                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                            <div key={d} className="bg-slate-50 dark:bg-slate-800/50 py-2 text-center text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                                {d}
                                            </div>
                                        ))}
                                        {generateCalendarDays().map((dayObj, i) => {
                                            const d = new Date(dayObj.year, dayObj.month, dayObj.day);
                                            // Format dateStr in local time to match database
                                            const y = d.getFullYear();
                                            const m = String(d.getMonth() + 1).padStart(2, '0');
                                            const dayNum = String(d.getDate()).padStart(2, '0');
                                            const dateStr = `${y}-${m}-${dayNum}`;

                                            const isToday = new Date().toLocaleDateString('en-CA') === dateStr;
                                            const override = specialHours.find(h => h.date === dateStr);
                                            // Calculate default state for UI hint
                                            const dayOfWeek = d.getDay();
                                            const dayDefault = weeklyHours.find(w => parseInt(w.day_of_week) === dayOfWeek);
                                            const isClosedByDefault = dayDefault?.is_closed;

                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => !dayObj.padding && handleDateClick(d)}
                                                    disabled={dayObj.padding}
                                                    className={`
                                                        min-h-[100px] p-2 text-left transition-all relative
                                                        ${dayObj.padding ? 'bg-slate-50/30 dark:bg-slate-900/10 cursor-default' : 'bg-white dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40'}
                                                        ${override ? 'ring-1 ring-inset ring-amber-500/30' : ''}
                                                    `}
                                                >
                                                    <span className={`
                                                        inline-flex items-center justify-center size-6 text-xs font-bold rounded-full mb-1
                                                        ${isToday ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-400'}
                                                        ${dayObj.padding ? 'opacity-20' : ''}
                                                    `}>
                                                        {dayObj.day}
                                                    </span>

                                                    {!dayObj.padding && (
                                                        <div className="space-y-1">
                                                            {override ? (
                                                                <div className={`p-1 rounded text-[9px] font-bold leading-tight ${override.is_closed ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                                    <div className="flex items-center gap-1">
                                                                        <div className="size-1 rounded-full bg-current"></div>
                                                                        {override.reason || (override.is_closed ? 'CLOSED' : 'OVERRIDE')}
                                                                    </div>
                                                                    {!override.is_closed && <div>{override.open_time} - {override.close_time}</div>}
                                                                </div>
                                                            ) : (
                                                                <div className="p-1 text-[9px] text-slate-400 font-medium">
                                                                    {isClosedByDefault ? 'Default: Closed' : `Default: ${dayDefault?.open_time}-${dayDefault?.close_time}`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </GlassCard>
                            )}

                            {/* Special Hours Modal */}
                            {showSpecialModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                                    <GlassCard data-testid="modal-schedule-override-form" className="w-full max-w-md relative">
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                                        <h2 className="text-xl font-bold mb-1">Set Special Hours</h2>
                                        <p className="text-sm text-slate-500 mb-6">
                                            {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'full' }) : ''}
                                        </p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Reason / Event Name</label>
                                                <input
                                                    type="text"
                                                    value={specialFormData.reason}
                                                    onChange={(e) => setSpecialFormData({ ...specialFormData, reason: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                                    placeholder="e.g. Labor Day, Renovation..."
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                <span className="text-sm font-bold">Store is Closed</span>
                                                <label className="relative cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={specialFormData.is_closed}
                                                        onChange={(e) => setSpecialFormData({ ...specialFormData, is_closed: e.target.checked })}
                                                    />
                                                    <div className={`w-10 h-5 rounded-full transition-colors ${specialFormData.is_closed ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                    <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${specialFormData.is_closed ? 'translate-x-5' : ''}`}></div>
                                                </label>
                                            </div>

                                            {!specialFormData.is_closed && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block px-1">Open Time</label>
                                                        <input
                                                            type="time"
                                                            value={specialFormData.open_time}
                                                            onChange={(e) => setSpecialFormData({ ...specialFormData, open_time: e.target.value })}
                                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block px-1">Close Time</label>
                                                        <input
                                                            type="time"
                                                            value={specialFormData.close_time}
                                                            onChange={(e) => setSpecialFormData({ ...specialFormData, close_time: e.target.value })}
                                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-3 mt-8">
                                                <button
                                                    onClick={() => setShowSpecialModal(false)}
                                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={saveSpecialHours}
                                                    data-testid="btn-hours-apply-all"
                                                    disabled={saving}
                                                    className="px-6 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {saving && <div className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full"></div>}
                                                    Apply Override
                                                </button>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BusinessHoursManagement;
