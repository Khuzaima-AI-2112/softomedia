import { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import TrafficTierBadge from '../../components/TrafficTierBadge';
import PriceDisplay from '../../components/PriceDisplay';
import apiService from '../../services/ApiService';
import pricingService from '../../services/PricingService';
import { authAPI } from '../../services/authAPI';

const LayoutTag = ({ name, position = 'top-left', isVisible = false }) => {
    if (!isVisible) return null;

    const posClasses = {
        'top-left': '-top-3 -left-2',
        'top-right': '-top-3 -right-2',
        'bottom-left': '-bottom-3 -left-2',
        'bottom-right': '-bottom-3 -right-2'
    };

    return (
        <div className={`absolute ${posClasses[position]} z - 10 bg - slate - 800 text - white text - [10px] px - 1.5 py - 0.5 rounded shadow - sm opacity - 60 group - hover: opacity - 100 pointer - events - none font - mono uppercase tracking - tighter border border - slate - 600 whitespace - nowrap`}>
            {name}
        </div>
    );
};

// Generate array of business hours (8 AM to 10 PM)
const getBusinessHours = () => {
    const hours = [];
    for (let h = 8; h < 22; h++) {
        hours.push(h);
    }
    return hours;
};

// Format hour to display string
const formatHour = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${suffix} `;
};

function CPMCalendar() {
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [showSectionLabels, setShowSectionLabels] = useState(false);

    // Auth Check
    const currentUser = useMemo(() => authAPI.getCurrentUser(), []);
    const isSuperAdmin = currentUser?.role === 'superadmin';

    const [pricingConfig, setPricingConfig] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editedBaseCPM, setEditedBaseCPM] = useState(15.00);
    const [tierEditMode, setTierEditMode] = useState(false);
    const [editedTiers, setEditedTiers] = useState({});
    const [dateOverride, setDateOverride] = useState(null);
    const [selectedRetailer, setSelectedRetailer] = useState('all');
    const [selectedStore, setSelectedStore] = useState(null);
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTier, setEditingTier] = useState(null);
    const [storeHours, setStoreHours] = useState(null);

    // Filter stores based on selected retailer
    const filteredStores = useMemo(() => {
        if (selectedRetailer === 'all') return stores;
        return stores.filter(s => s.retailer_id === selectedRetailer);
    }, [selectedRetailer, stores]);

    useEffect(() => {
        if (filteredStores.length > 0 && !selectedStore) {
            setSelectedStore(filteredStores[0]);
        } else if (filteredStores.length > 0 && selectedStore) {
            // Verify selected store is still valid for retailer
            const exists = filteredStores.find(s => s.id === selectedStore.id);
            if (!exists) setSelectedStore(filteredStores[0]);
        }
    }, [filteredStores]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (pricingConfig) {
            setEditedBaseCPM(pricingConfig.baseCPM || 15.00);
            setEditedTiers(JSON.parse(JSON.stringify(pricingConfig.trafficTiers || {})));
            setDateOverride(pricingConfig.dateOverrides?.[selectedDate] || null);
        }
    }, [selectedDate, pricingConfig]);

    useEffect(() => {
        const fetchStoreHours = async () => {
            if (selectedStore && selectedDate) {
                try {
                    const hours = await apiService.getEffectiveHours(selectedStore.id, selectedDate);
                    setStoreHours(hours);
                } catch (error) {
                    console.error('Failed to fetch effective hours:', error);
                    // Fallback default
                    setStoreHours({ open_time: '08:00', close_time: '22:00', is_closed: false });
                }
            }
        };
        fetchStoreHours();
    }, [selectedStore, selectedDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [config, retailersData, storesData] = await Promise.all([
                apiService.getPricingConfig(),
                apiService.getRetailers(),
                apiService.getStores()
            ]);
            setPricingConfig(config);
            setRetailers(retailersData || []);
            setStores(storesData || []);
            setEditedBaseCPM(config.baseCPM || 15.00);
        } catch (error) {
            console.error('Failed to load pricing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBaseCPM = async () => {
        try {
            console.log('[CPM_CALENDAR] Save initiated:', { newBaseCPM: editedBaseCPM });

            // Call backend API to update
            const result = await apiService.updatePricingConfig({ baseCPM: editedBaseCPM });

            console.log('[CPM_CALENDAR] Backend response:', {
                baseCPM: result.baseCPM,
                retailerOverrides: result.retailerOverrides,
                updatedAt: result.updatedAt
            });

            // CRITICAL: Force refresh of pricing service with new data from database
            console.log('[CPM_CALENDAR] Forcing pricing service refresh...');
            await pricingService.init(true);

            // Update local state with fresh data from service
            const updatedConfig = pricingService.config;
            setPricingConfig(updatedConfig);
            setEditMode(false);

            console.log('[CPM_CALENDAR] Update complete:', {
                baseCPM: updatedConfig?.baseCPM,
                retailerOverrides: Object.keys(updatedConfig?.retailerOverrides || {}).length
            });

        } catch (error) {
            console.error('[CPM_CALENDAR] Save failed:', error);
            alert('Update failed: ' + error.message);
        }
    };

    const handleSaveTiers = async () => {
        try {
            console.log('[CPM_CALENDAR] Saving traffic tiers...');
            const updated = await apiService.updatePricingConfig({ trafficTiers: editedTiers });
            await pricingService.updateConfig(updated);
            setPricingConfig(pricingService.config);
            setTierEditMode(false);
            console.log('[CPM_CALENDAR] Tiers saved successfully');
        } catch (error) {
            console.error('[CPM_CALENDAR] Failed to update traffic tiers:', error);
            alert('Update failed');
        }
    };

    const handleSetHourlyTier = async (hour, tierKey) => {
        try {
            const currentOverrides = pricingConfig.dateOverrides || {};
            const dateOverride = currentOverrides[selectedDate] || { multiplier: 1.0, label: 'Manual' };
            const hourlyTiers = dateOverride.hourlyTiers || {};

            const updatedHourlyTiers = {
                ...hourlyTiers,
                [hour]: tierKey
            };

            const updatedOverrides = {
                ...currentOverrides,
                [selectedDate]: {
                    ...dateOverride,
                    hourlyTiers: updatedHourlyTiers
                }
            };

            const updated = await apiService.updatePricingConfig({ dateOverrides: updatedOverrides });
            pricingService.updateConfig(updated);
            setPricingConfig(updated);
        } catch (error) {
            console.error('Failed to set hourly tier override:', error);
        }
    };

    const handleSetDateOverride = async (multiplier, label) => {
        try {
            const currentOverrides = pricingConfig.dateOverrides || {};
            const updatedOverrides = {
                ...currentOverrides,
                [selectedDate]: { multiplier, label }
            };
            const updated = await apiService.updatePricingConfig({ dateOverrides: updatedOverrides });
            pricingService.updateConfig(updated);
            setPricingConfig(updated);
        } catch (error) {
            console.error('Failed to set date override:', error);
        }
    };

    const handleSaveTrafficTier = async (tierKey, updates) => {
        try {
            console.log(`[CPM_CALENDAR] Saving tier ${tierKey}...`, updates);
            const newTiers = { ...pricingConfig.trafficTiers, [tierKey]: { ...pricingConfig.trafficTiers[tierKey], ...updates } };
            await apiService.updatePricingConfig({ trafficTiers: newTiers });

            // LAYER 2: Secure Reactive Pulse
            console.log('[CPM_CALENDAR] Refreshing pricing service...');
            await pricingService.init(true);
            const updatedConfig = pricingService.getConfig();
            setPricingConfig(updatedConfig);

            setEditingTier(null);
            alert('Traffic tier updated successfully');
        } catch (error) {
            console.error('Failed to update traffic tier:', error);
            alert('Failed to update traffic tier');
        }
    };

    const handleClearDateOverride = async () => {
        try {
            const currentOverrides = { ...(pricingConfig.dateOverrides || {}) };
            delete currentOverrides[selectedDate];
            const updated = await apiService.updatePricingConfig({ dateOverrides: currentOverrides });
            pricingService.updateConfig(updated);
            setPricingConfig(updated);
        } catch (error) {
            console.error('Failed to clear date override:', error);
        }
    };

    const handleRetailerOverride = async (retailerId, baseCPM) => {
        try {
            const currentOverrides = { ...(pricingConfig.retailerOverrides || {}) };
            if (baseCPM === null) {
                delete currentOverrides[retailerId];
            } else {
                currentOverrides[retailerId] = { baseCPM };
            }
            const updated = await apiService.updatePricingConfig({ retailerOverrides: currentOverrides });
            pricingService.updateConfig(updated);
            setPricingConfig(updated);
        } catch (error) {
            console.error('Failed to update retailer override:', error);
        }
    };

    // Generate calendar days for current month
    const getCalendarDays = () => {
        // Parse YYYY-MM-DD explicitly to avoid UTC conversion
        const [y, m, d] = selectedDate.split('-').map(Number);
        const selected = new Date(y, m - 1, d);
        const year = selected.getFullYear();
        const month = selected.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        // Add empty cells for days before first of month
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add days of month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year} -${String(month + 1).padStart(2, '0')} -${String(d).padStart(2, '0')} `;
            days.push({
                day: d,
                date: dateStr,
                hasOverride: !!(pricingConfig?.dateOverrides?.[dateStr]),
                isSelected: dateStr === selectedDate,
                isToday: dateStr === new Date().toLocaleDateString('en-CA')
            });
        }

        return days;
    };

    const dailySummary = useMemo(() => {
        if (!pricingConfig) return { totalScreens: 0, hourlyBreakdown: [] };

        // Calculate range based on store hours
        let range = null;
        if (storeHours && !storeHours.is_closed) {
            const startStr = storeHours.open_time.split(':')[0];
            const endStr = storeHours.close_time.split(':')[0];
            range = {
                START: parseInt(startStr),
                END: parseInt(endStr)
            };
        } else if (storeHours && storeHours.is_closed) {
            range = { START: 0, END: 0 }; // Closed
        }

        return pricingService.getDailyPricingSummary(selectedDate, range);
    }, [selectedDate, pricingConfig, storeHours]);

    if (!pricingConfig) {
        return <div className="animate-pulse">Loading pricing configuration...</div>;
    }

    const calendarDays = getCalendarDays();
    // Parse selectedDate locally to avoid UTC offset
    const [selY, selM] = selectedDate.split('-').map(Number);
    const currentMonth = new Date(selY, selM - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative group/main">
            <LayoutTag name="main-section" position="top-left" isVisible={showSectionLabels} />
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Pricing Calendar
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Manage CPM pricing, traffic tiers, and date overrides
                    </p>
                </div>
                {isSuperAdmin && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Overlay Labels</span>
                        <button
                            data-testid="overlay-toggle"
                            onClick={() => setShowSectionLabels(!showSectionLabels)}
                            className={`w-9 h-5 rounded-full relative transition-colors ${showSectionLabels ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showSectionLabels ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <select
                        value={selectedRetailer}
                        onChange={(e) => {
                            setSelectedRetailer(e.target.value);
                            setSelectedStore(null); // Reset store when retailer changes
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value="all">All Retailers</option>
                        {retailers.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedStore?.id || ''}
                        onChange={(e) => setSelectedStore(stores.find(s => s.id === e.target.value))}
                        disabled={!stores.length}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                        {filteredStores.length === 0 ? <option>No Stores</option> : null}
                        {filteredStores.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative group/stats">
                <LayoutTag name="stats-row" position="top-right" isVisible={showSectionLabels} />
                <GlassCard className="border-l-4 border-l-primary relative group/base">
                    <LayoutTag name="col:base-cpm" position="bottom-left" isVisible={showSectionLabels} />
                    <p className="text-sm font-medium text-slate-500 mb-1">Base CPM</p>
                    <div className="flex items-end justify-between">
                        {editMode ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editedBaseCPM}
                                    onChange={(e) => setEditedBaseCPM(parseFloat(e.target.value) || 0)}
                                    className="w-24 px-2 py-1 rounded border border-primary bg-white dark:bg-slate-800 text-lg font-bold"
                                />
                                <button
                                    onClick={handleSaveBaseCPM}
                                    className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                                >
                                    <span className="material-symbols-outlined text-xl">check</span>
                                </button>
                                <button
                                    onClick={() => { setEditMode(false); setEditedBaseCPM(pricingConfig.baseCPM); }}
                                    className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                <PriceDisplay price={pricingConfig.baseCPM || pricingConfig.base_cpm || 15.00} showCPM size="large" />
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                            </>
                        )}
                    </div>
                </GlassCard>

                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">High Traffic Multiplier</p>
                    <p className="text-2xl font-bold text-emerald-500">
                        {pricingConfig?.trafficTiers?.high?.multiplier || '1.5'}x
                    </p>
                    <p className="text-xs text-slate-400 mt-1">12-1 PM, 5-6 PM</p>
                </GlassCard>

                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Screens</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {dailySummary.totalScreens}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Across all retailers</p>
                </GlassCard>

                <GlassCard className="border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Date Override</p>
                    {dateOverride ? (
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-blue-500">{dateOverride.multiplier}x</span>
                            <span className="text-xs text-slate-500">{dateOverride.label}</span>
                            <button
                                onClick={handleClearDateOverride}
                                className="ml-auto p-1 text-slate-400 hover:text-rose-500 rounded"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm">No override set</p>
                    )}
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative group/calendar-row">
                <LayoutTag name="calendar-details-row" position="top-right" isVisible={showSectionLabels} />
                {/* Calendar */}
                <GlassCard className="lg:col-span-1 relative group/cal">
                    <LayoutTag name="col:calendar" position="bottom-left" isVisible={showSectionLabels} />
                    <h3 className="font-bold text-lg mb-4">{currentMonth}</h3>

                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => {
                                const [y, m, day] = selectedDate.split('-').map(Number);
                                const d = new Date(y, m - 1, day);
                                d.setMonth(d.getMonth() - 1);
                                setSelectedDate(d.toLocaleDateString('en-CA'));
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button
                            onClick={() => setSelectedDate(new Date().toLocaleDateString('en-CA'))}
                            className="text-sm text-primary hover:underline"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const [y, m, day] = selectedDate.split('-').map(Number);
                                const d = new Date(y, m - 1, day);
                                d.setMonth(d.getMonth() + 1);
                                setSelectedDate(d.toLocaleDateString('en-CA'));
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, i) => (
                            <button
                                key={i}
                                onClick={() => day && setSelectedDate(day.date)}
                                disabled={!day}
                                className={`
aspect - square flex items - center justify - center text - sm rounded - lg relative
                                    ${!day ? 'invisible' : ''}
                                    ${day?.isSelected ? 'bg-primary text-white font-bold' : ''}
                                    ${day?.isToday && !day?.isSelected ? 'ring-2 ring-primary' : ''}
                                    ${day && !day.isSelected ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}
`}
                            >
                                {day?.day}
                                {day?.hasOverride && (
                                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-500"></span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Quick Override Buttons */}
                    <div className="mt-6 space-y-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Quick Override for {(() => { const [y, m, d] = selectedDate.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })()}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleSetDateOverride(1.5, 'Holiday')}
                                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                🎉 Holiday (+50%)
                            </button>
                            <button
                                onClick={() => handleSetDateOverride(2.0, 'Major Event')}
                                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                🏆 Event (+100%)
                            </button>
                            <button
                                onClick={() => handleSetDateOverride(0.75, 'Slow Day')}
                                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                📉 Slow Day (-25%)
                            </button>
                            <button
                                onClick={handleClearDateOverride}
                                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 transition-colors"
                            >
                                ✕ Clear Override
                            </button>
                        </div>
                    </div>
                </GlassCard>

                {/* Hourly Breakdown */}
                <GlassCard className="lg:col-span-2 relative group/hourly">
                    <LayoutTag name="col:hourly-breakdown" position="bottom-right" isVisible={showSectionLabels} />
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">
                                Hourly Pricing - {(() => { const [y, m, d] = selectedDate.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); })()}
                            </h3>
                            {storeHours?.is_closed && (
                                <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">
                                    CLOSED
                                </span>
                            )}
                            {!storeHours?.is_closed && storeHours && (
                                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    {storeHours.open_time} - {storeHours.close_time}
                                </span>
                            )}
                        </div>
                        {dateOverride && (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                {dateOverride.label}: {dateOverride.multiplier}x multiplier
                            </span>
                        )}
                    </div>

                    {storeHours?.is_closed ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">store_off</span>
                            <p className="font-medium">Store Is Closed</p>
                            <p className="text-xs">No active pricing slots for this date.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hour</th>
                                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Traffic Tier</th>
                                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Avg Slot CPM</th>
                                        <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Est. Impressions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {dailySummary.hourlyBreakdown.length > 0 ? (
                                        dailySummary.hourlyBreakdown.map((hourData) => (
                                            <tr key={hourData.hour} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="py-3 font-mono text-sm">
                                                    {formatHour(hourData.hour)}
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={hourData.trafficTier.key}
                                                            onChange={(e) => handleSetHourlyTier(hourData.hour, e.target.value)}
                                                            className="bg-transparent text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 focus:ring-1 focus:ring-primary outline-none"
                                                        >
                                                            {Object.keys(pricingConfig?.trafficTiers || {}).map(tierKey => (
                                                                <option key={tierKey} value={tierKey}>
                                                                    {pricingConfig.trafficTiers[tierKey].label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {pricingConfig?.dateOverrides?.[selectedDate]?.hourlyTiers?.[hourData.hour] && (
                                                            <span className="size-1.5 rounded-full bg-blue-500" title="Override Active"></span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <PriceDisplay price={hourData.averageSlotPrice} size="small" />
                                                </td>
                                                <td className="py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                                    {pricingService.formatImpressions(hourData.totalEstimatedImpressions)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-slate-400 text-sm">
                                                No active hours configured for this day.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Retailer Overrides */}
            <GlassCard className="relative group/retailer">
                <LayoutTag name="retailer-overrides" position="top-left" isVisible={showSectionLabels} />
                <h3 className="font-bold text-lg mb-4">Retailer Pricing Overrides</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {retailers.map(retailer => {
                        const override = pricingConfig.retailerOverrides?.[retailer.id];
                        const retailerStores = stores.filter(s => s.retailer_id === retailer.id);
                        return (
                            <div
                                key={retailer.id}
                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">{retailer.logo}</span>
                                    <div>
                                        <p className="font-bold text-sm">{retailer.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {retailerStores.length} stores
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Base CPM:</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder={(pricingConfig.baseCPM || 15).toString()}
                                            value={override?.baseCPM || ''}
                                            onChange={(e) => handleRetailerOverride(
                                                retailer.id,
                                                e.target.value ? parseFloat(e.target.value) : null
                                            )}
                                            className="w-20 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                        {override && (
                                            <span className="text-xs text-emerald-500 font-medium">
                                                Override active
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </GlassCard>

            {/* Traffic Tier Configuration */}
            <GlassCard className="relative group/tiers">
                <LayoutTag name="traffic-tiers-config" position="bottom-right" isVisible={showSectionLabels} />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Traffic Tier Configuration</h3>
                    {!tierEditMode ? (
                        <button
                            onClick={() => setTierEditMode(true)}
                            className="text-xs text-primary font-bold hover:underline"
                        >
                            Edit Tiers
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSaveTiers}
                                className="px-3 py-1 text-xs bg-emerald-500 text-white rounded-lg font-bold"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setTierEditMode(false);
                                    setEditedTiers(JSON.parse(JSON.stringify(pricingConfig.trafficTiers || {})));
                                }}
                                className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded-lg font-bold"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(tierEditMode ? editedTiers : (pricingConfig?.trafficTiers || {})).map(([key, tier]) => (
                        <div
                            key={key}
                            className="p-4 rounded-xl border-2"
                            style={{ borderColor: tier?.color + '40', backgroundColor: tier?.color + '10' }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <TrafficTierBadge tier={key} />
                                {tierEditMode ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={tier?.multiplier}
                                            onChange={(e) => setEditedTiers({
                                                ...editedTiers,
                                                [key]: { ...tier, multiplier: parseFloat(e.target.value) }
                                            })}
                                            className="w-16 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                        <span className="text-xs text-slate-500">x</span>
                                    </div>
                                ) : (
                                    <span className="text-lg font-bold" style={{ color: tier?.color }}>
                                        {tier?.multiplier}x
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                                Hours: {tier?.hours?.map(h => formatHour(h).replace(':00 ', '')).join(', ') || 'N/A'}
                            </p>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}

export default CPMCalendar;
