/**
 * Step2ScheduleUpload - Campaign name and date range selection
 * Part of the advertiser campaign booking wizard (5-step flow)
 */

import GlassCard from '../../../components/GlassCard';

const Step2ScheduleUpload = ({ data, updateData, onNext, onPrev }) => {
    // Bug #27 fix: append T00:00:00 so YYYY-MM-DD parses in local time,
    // not UTC midnight (which renders as the previous day in UTC- zones).
    const getDuration = () => {
        if (!data.dateRange?.start || !data.dateRange?.end) return 0;
        const start = new Date(data.dateRange.start + 'T00:00:00');
        const end   = new Date(data.dateRange.end   + 'T00:00:00');
        return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    };

    const duration = getDuration();



    const handleContinue = () => {

        if (!data.campaignName) {
            updateData({ campaignName: 'Untitled Campaign' });
        }
        onNext();
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Step Header */}
            <GlassCard className="border-l-4 border-l-primary">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Step 2: Campaign Schedule</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Set your campaign name and date range
                        </p>
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Campaign Name */}
                <GlassCard>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">badge</span>
                        Campaign Name
                    </h3>
                    <input
                        type="text"
                        data-testid="input-campaign-name"
                        value={data.campaignName || ''}
                        onChange={(e) => updateData({ campaignName: e.target.value })}
                        placeholder="e.g., Summer Sale 2026"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-sm text-slate-500 mt-2">
                        Choose a memorable name for your campaign
                    </p>
                </GlassCard>

                {/* Budget */}
                <GlassCard>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">payments</span>
                        Campaign Budget
                    </h3>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
                        <input
                            type="number"
                            data-testid="select-campaign-budget"
                            value={data.budget || 1000}
                            onChange={(e) => updateData({ budget: parseInt(e.target.value) || 0 })}
                            min="100"
                            step="100"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        Set your maximum spending limit
                    </p>
                </GlassCard>
            </div>

            {/* Date Range */}
            <GlassCard>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">date_range</span>
                    Campaign Duration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Start Date</label>
                        <input
                            type="date"
                            data-testid="campaign-start-date-input"
                            value={data.dateRange?.start || ''}
                            onChange={(e) => updateData({
                                dateRange: { ...data.dateRange, start: e.target.value }
                            })}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">End Date</label>
                        <input
                            type="date"
                            data-testid="campaign-end-date-input"
                            value={data.dateRange?.end || ''}
                            onChange={(e) => updateData({
                                dateRange: { ...data.dateRange, end: e.target.value }
                            })}
                            min={data.dateRange?.start || new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <p className="text-4xl font-black text-primary">{duration}</p>
                        <p className="text-sm text-slate-500">Days</p>
                    </div>
                </div>
            </GlassCard>

            {/* Selected Screens Summary */}
            <GlassCard className="bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">tv</span>
                        </div>
                        <div>
                            <p className="font-bold">{(data.selectedScreens || []).length} Screens Selected</p>
                            <p className="text-sm text-slate-500">{(data.selectedStores || []).length} Stores</p>
                        </div>
                    </div>
                    <button
                        onClick={onPrev}
                        className="text-primary hover:underline text-sm font-medium"
                    >
                        Change Selection
                    </button>
                </div>
            </GlassCard>

            {/* Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111722] border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
                <div className="max-w-[1440px] mx-auto px-10 py-4 flex items-center justify-between">
                    <button
                        onClick={onPrev}
                        className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                        Back
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Campaign Duration</p>
                            <p className="font-bold text-lg">{duration} Days</p>
                        </div>
                        <button
                            onClick={handleContinue}
                            disabled={duration < 1}
                            data-testid="step-2-next-btn"
                            className="px-8 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Select Time Slots</span>
                            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step2ScheduleUpload;
