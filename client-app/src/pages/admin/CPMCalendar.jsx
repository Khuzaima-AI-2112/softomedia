/**
 * CPM Calendar - Admin Pricing Management
 * Manage CPM pricing across the network with traffic tiers and date overrides
 */

import React, { useState, useEffect, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import TrafficTierBadge from '../../components/TrafficTierBadge';
import PriceDisplay from '../../components/PriceDisplay';
import localStorageService, { BUSINESS_HOURS, DEFAULT_TRAFFIC_TIERS } from '../../services/LocalStorageService';
import pricingService from '../../services/PricingService';

// Generate array of business hours
const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) {
        hours.push(h);
    }
    return hours;
};

// Format hour to display string
const formatHour = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${suffix}`;
};

function CPMCalendar() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [pricingConfig, setPricingConfig] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editedBaseCPM, setEditedBaseCPM] = useState(2.50);
    const [dateOverride, setDateOverride] = useState(null);
    const [selectedRetailer, setSelectedRetailer] = useState('all');
    const [retailers, setRetailers] = useState([]);

    const businessHours = useMemo(() => getBusinessHours(), []);

    useEffect(() => {
        localStorageService.init();
        loadData();
    }, []);

    useEffect(() => {
        if (pricingConfig) {
            setEditedBaseCPM(pricingConfig.baseCPM);
            setDateOverride(pricingConfig.dateOverrides?.[selectedDate] || null);
        }
    }, [selectedDate, pricingConfig]);

    const loadData = () => {
        const config = localStorageService.getPricingConfig();
        setPricingConfig(config);
        setEditedBaseCPM(config.baseCPM);
        setRetailers(localStorageService.getRetailers());
    };

    const handleSaveBaseCPM = () => {
        const updated = localStorageService.updatePricingConfig({ baseCPM: editedBaseCPM });
        setPricingConfig(updated);
        setEditMode(false);
    };

    const handleSetDateOverride = (multiplier, label) => {
        localStorageService.setDateOverride(selectedDate, { multiplier, label });
        loadData();
    };

    const handleClearDateOverride = () => {
        const config = localStorageService.getPricingConfig();
        delete config.dateOverrides[selectedDate];
        localStorageService.updatePricingConfig({ dateOverrides: config.dateOverrides });
        loadData();
    };

    const handleRetailerOverride = (retailerId, baseCPM) => {
        const config = localStorageService.getPricingConfig();
        if (baseCPM === null) {
            delete config.retailerOverrides[retailerId];
        } else {
            config.retailerOverrides[retailerId] = { baseCPM };
        }
        localStorageService.updatePricingConfig({ retailerOverrides: config.retailerOverrides });
        loadData();
    };

    // Generate calendar days for current month
    const getCalendarDays = () => {
        const selected = new Date(selectedDate);
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
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            days.push({
                day: d,
                date: dateStr,
                hasOverride: !!pricingConfig?.dateOverrides?.[dateStr],
                isSelected: dateStr === selectedDate,
                isToday: dateStr === new Date().toISOString().split('T')[0]
            });
        }

        return days;
    };

    const dailySummary = useMemo(() => {
        return pricingService.getDailyPricingSummary(selectedDate);
    }, [selectedDate, pricingConfig]);

    if (!pricingConfig) {
        return <div className="animate-pulse">Loading pricing configuration...</div>;
    }

    const calendarDays = getCalendarDays();
    const currentMonth = new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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
                <div className="flex items-center gap-3">
                    <select
                        value={selectedRetailer}
                        onChange={(e) => setSelectedRetailer(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    >
                        <option value="all">All Retailers</option>
                        {retailers.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
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
                                <PriceDisplay price={pricingConfig.baseCPM} showCPM size="large" />
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
                        {pricingConfig.trafficTiers.high.multiplier}x
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <GlassCard className="lg:col-span-1">
                    <h3 className="font-bold text-lg mb-4">{currentMonth}</h3>

                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setMonth(d.getMonth() - 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className="text-sm text-primary hover:underline"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setMonth(d.getMonth() + 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
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
                                    aspect-square flex items-center justify-center text-sm rounded-lg relative
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
                            Quick Override for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                <GlassCard className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">
                            Hourly Pricing - {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </h3>
                        {dateOverride && (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                {dateOverride.label}: {dateOverride.multiplier}x multiplier
                            </span>
                        )}
                    </div>

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
                                {dailySummary.hourlyBreakdown.map((hourData) => (
                                    <tr key={hourData.hour} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="py-3 font-mono text-sm">
                                            {formatHour(hourData.hour)}
                                        </td>
                                        <td className="py-3">
                                            <TrafficTierBadge tier={hourData.trafficTier.key} size="small" />
                                        </td>
                                        <td className="py-3 text-right">
                                            <PriceDisplay price={hourData.averageSlotPrice} size="small" />
                                        </td>
                                        <td className="py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                            {pricingService.formatImpressions(hourData.totalEstimatedImpressions)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            </div>

            {/* Retailer Overrides */}
            <GlassCard>
                <h3 className="font-bold text-lg mb-4">Retailer Pricing Overrides</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {retailers.map(retailer => {
                        const override = pricingConfig.retailerOverrides?.[retailer.id];
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
                                            {localStorageService.getStores(retailer.id).length} stores
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
                                            placeholder={pricingConfig.baseCPM.toString()}
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
            <GlassCard>
                <h3 className="font-bold text-lg mb-4">Traffic Tier Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(pricingConfig.trafficTiers).map(([key, tier]) => (
                        <div
                            key={key}
                            className="p-4 rounded-xl border-2"
                            style={{ borderColor: tier.color + '40', backgroundColor: tier.color + '10' }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <TrafficTierBadge tier={key} />
                                <span className="text-lg font-bold" style={{ color: tier.color }}>
                                    {tier.multiplier}x
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Hours: {tier.hours.map(h => formatHour(h).replace(':00 ', '')).join(', ')}
                            </p>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}

export default CPMCalendar;
