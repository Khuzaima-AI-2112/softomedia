/**
 * Loop Management Page
 * Admin interface for viewing and managing daily broadcast loops
 * Business Hours: 8am - 10pm (14 loops per day)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import { API_URL } from '../../config';

// Business hours configuration
const BUSINESS_HOURS = {
    START: 8,
    END: 22
};

// Generate array of business hours
const getBusinessHours = () => {
    const hours = [];
    for (let h = BUSINESS_HOURS.START; h < BUSINESS_HOURS.END; h++) {
        hours.push(h);
    }
    return hours;
};

// Format hour to display string (e.g., "8:00 AM")
const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

// Get status color for loop
const getStatusColor = (status) => {
    switch (status) {
        case 'APPROVED': return 'bg-emerald-500';
        case 'PENDING_APPROVAL': return 'bg-amber-500';
        case 'REJECTED': return 'bg-red-500';
        case 'LIVE': return 'bg-blue-500';
        default: return 'bg-slate-400';
    }
};

function LoopManagement() {
    const navigate = useNavigate();
    const [targetDate, setTargetDate] = useState(() => {
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [loops, setLoops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const businessHours = getBusinessHours();

    useEffect(() => {
        fetchLoops();
    }, [targetDate]);

    const fetchLoops = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/loops?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                setLoops(data.loops || []);
            }
        } catch (error) {
            console.error('Failed to fetch loops:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`${API_URL}/api/loops/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetDate,
                    retailerId: 'ret_demo', // 🔶 TODO: Get from context/selection
                    locationId: 'loc_downtown', // 🔶 TODO: Get from context/selection
                    mock: true // Use mock generation for demo
                })
            });
            if (res.ok) {
                await fetchLoops();
            }
        } catch (error) {
            console.error('Failed to generate loops:', error);
        } finally {
            setGenerating(false);
        }
    };

    const getLoopForHour = (hour) => {
        return loops.find(l => l.hour === hour) || null;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Loop Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Configure and manage 14-hour broadcast loops (8AM - 10PM)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        data-testid="loop-date-picker"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                        data-testid="generate-loops-btn"
                    >
                        <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                        {generating ? 'Generating...' : 'Generate Loops'}
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Hours</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{businessHours.length}</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Approved</p>
                    <p className="text-3xl font-bold text-emerald-500">
                        {loops.filter(l => l.status === 'APPROVED').length}
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Pending</p>
                    <p className="text-3xl font-bold text-amber-500">
                        {loops.filter(l => l.status === 'PENDING_APPROVAL').length}
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-red-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Rejected</p>
                    <p className="text-3xl font-bold text-red-500">
                        {loops.filter(l => l.status === 'REJECTED').length}
                    </p>
                </GlassCard>
            </div>

            {/* 14-Hour Grid */}
            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">schedule</span>
                        Hourly Loop Grid — {new Date(targetDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </h3>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Approved
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Pending
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-slate-400"></span> Empty
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-500 animate-pulse">
                        Loading loops...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-3" data-testid="loop-grid">
                        {businessHours.map(hour => {
                            const loop = getLoopForHour(hour);
                            const filledSlots = loop?.slots?.filter(s => s.asset_id).length || 0;

                            return (
                                <button
                                    key={hour}
                                    onClick={() => loop && navigate(`/dashboard/admin/loops/${loop.id}`)}
                                    disabled={!loop}
                                    className={`p-4 rounded-xl border transition-all text-left ${loop
                                            ? 'border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-lg cursor-pointer'
                                            : 'border-dashed border-slate-300 dark:border-slate-700 opacity-50 cursor-not-allowed'
                                        }`}
                                    data-testid={`loop-hour-${hour}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                            {formatHour(hour)}
                                        </span>
                                        {loop && (
                                            <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(loop.status)}`}></span>
                                        )}
                                    </div>

                                    {loop ? (
                                        <>
                                            <div className="text-xs text-slate-500 mb-2">
                                                {filledSlots}/12 slots filled
                                            </div>
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: 12 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1.5 flex-1 rounded-full ${loop.slots?.[i]?.asset_id
                                                                ? loop.slots[i].status === 'REJECTED'
                                                                    ? 'bg-red-400'
                                                                    : 'bg-primary'
                                                                : 'bg-slate-200 dark:bg-slate-700'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">
                                            No loop generated
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </GlassCard>

            {/* Empty State */}
            {!loading && loops.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">calendar_month</span>
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">
                        No Loops Generated
                    </h3>
                    <p className="text-slate-500 mb-6">
                        Generate loops for {targetDate} to start scheduling ads.
                    </p>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="px-6 py-3 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors"
                    >
                        {generating ? 'Generating...' : 'Generate D-1 Loops'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default LoopManagement;
