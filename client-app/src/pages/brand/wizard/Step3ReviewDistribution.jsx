import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../../config';
import useAsyncAction from '../../../hooks/useAsyncAction';

const Step3ReviewDistribution = ({ data, onConfirm, onPrev }) => {
    const navigate = useNavigate();

    // Campaign creation function wrapped by useAsyncAction
    const createCampaign = useCallback(async () => {
        console.log('[Wizard] Confirming distribution...');
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/campaigns`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: `Campaign - ${new Date().toLocaleDateString()}`,
                retailer_id: data.selectedStore?.id || 'ent_costco',
                location_ids: data.selectedScreens,
                media_id: data.media_id,
                start_date: data.dateRange.start,
                end_date: data.dateRange.end,
                selectedSlots: data.selectedSlots
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Campaign creation failed');
        }

        return res.json();
    }, [data]);

    // Use hook for automatic loading state
    const { execute: handleConfirm, isLoading: isSubmitting, error } = useAsyncAction(createCampaign, {
        onSuccess: () => {
            if (onConfirm) onConfirm();
            navigate('/dashboard/brand');
        },
        onError: (err) => console.error('Failed to create campaign:', err)
    });

    const metrics = [
        { label: 'Frequency / Hour', value: '12x', sub: 'Every 5 mins', color: 'text-primary' },
        { label: 'Total Loops / Day', value: '192', sub: 'Across 16 operational hours', color: 'text-blue-500' },
        { label: 'Est. Impressions', value: '250k', sub: 'Based on foot traffic', color: 'text-indigo-500' },
    ];

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {/* Visual Loop Section */}
            <section className="bg-white dark:bg-surface-dark rounded-xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        <h2 className="text-xl font-bold">1-Hour Loop Visualization</h2>
                    </div>
                </div>

                <div className="relative pt-6 pb-2">
                    {/* Time markers */}
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-2 font-mono">
                        <span>00:00</span><span>15:00</span><span>30:00</span><span>45:00</span><span>60:00</span>
                    </div>
                    {/* Bar Container (12 slots of 5 mins each for demo) */}
                    <div className="h-14 w-full bg-slate-100 dark:bg-slate-800 rounded-xl flex overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 shadow-inner">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div
                                key={i}
                                className={`flex-1 border-r border-white/20 dark:border-slate-900/50 transition-all ${i % 2 === 0 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                            />
                        ))}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-6 items-center border-t border-slate-100 dark:border-slate-800 mt-6 pt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary shadow-sm shadow-primary/40"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Your Ad (6 Slots)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Other Content</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 flex gap-4 items-start">
                    <span className="material-symbols-outlined text-primary mt-0.5">info</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        Your ad is scheduled to play <strong>every 5 minutes</strong> ensuring maximum visibility during peak operational hours.
                    </p>
                </div>
            </section>

            {/* Impact Projection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className="p-6 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{m.label}</p>
                        <p className={`text-3xl font-black mb-1 ${m.color}`}>{m.value}</p>
                        <p className="text-[11px] text-slate-500">{m.sub}</p>
                    </div>
                ))}
            </div>

            {/* Config Summary Table */}
            <section className="bg-white dark:bg-surface-dark rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
                    <h3 className="font-bold">Configuration Details</h3>
                </div>
                <div className="p-0">
                    <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                                { l: 'Date Range', v: 'Oct 05 - Oct 12, 2023' },
                                { l: 'Active Hours', v: '08:00 - 16:00 (8 Hours)' },
                                { l: 'Target Screens', v: `${data.selectedScreens.length} Units in Seattle/SF` },
                                { l: 'Frequency', v: '6 Slots / Hour' },
                                { l: 'Total Cost', v: '$720.00', bold: true, color: 'text-primary' }
                            ].map((row, i) => (
                                <tr key={i} className="group">
                                    <td className="px-6 py-4 text-slate-500 font-medium w-48">{row.l}</td>
                                    <td className={`px-6 py-4 font-semibold ${row.bold ? 'text-lg' : ''} ${row.color || 'text-slate-900 dark:text-white'}`}>
                                        {row.v}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-primary hover:underline text-xs opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Final Actions */}
            <div className="flex items-center justify-between py-6">
                <button
                    onClick={onPrev}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold px-4 py-2 transition-all group"
                >
                    <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    <span>Back to Scheduling</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Total to confirm</span>
                        <span className="text-2xl font-black text-primary">$720.00</span>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        data-testid="confirm-distribution-btn"
                        className={`px-10 py-4 rounded-xl text-white font-black shadow-xl transition-all flex items-center gap-2 ${isSubmitting
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-primary hover:bg-primary/90 shadow-primary/30 active:scale-95'
                            }`}
                    >
                        <span>{isSubmitting ? 'Submitting...' : 'Confirm Distribution'}</span>
                        <span className="material-symbols-outlined text-[20px]">
                            {isSubmitting ? 'sync' : 'task_alt'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Step3ReviewDistribution;
