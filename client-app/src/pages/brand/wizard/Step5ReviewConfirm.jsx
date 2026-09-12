import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../../components/GlassCard';
import LoopVisualisationBar from '../../../components/LoopVisualisationBar';
import { PriceSummary } from '../../../components/PriceDisplay';
import TrafficTierBadge from '../../../components/TrafficTierBadge';
import apiService from '../../../services/ApiService';
import pricingService from '../../../services/PricingService';

// Bug #27 fix: accept `submitting` prop from wizard so button reflects in-flight state
function Step5ReviewConfirm({ data, onConfirm, submitting, onPrev }) {
    const navigate = useNavigate();
    const [termsAgreed, setTermsAgreed] = useState(true);

    const summary = useMemo(() => {
        const slots = data.selectedSlots || [];
        const totalCost = slots.reduce((sum, s) => sum + (s.price || 0), 0);
        let totalImpressions = 0;

        slots.forEach(s => {
            totalImpressions += pricingService.getEstimatedImpressions(s.screen_id, s.hour);
        });

        const byDateHour = slots.reduce((acc, slot) => {
            const key = `${slot.date}_${slot.hour}`;
            if (!acc[key]) {
                acc[key] = { date: slot.date, hour: slot.hour, count: 0 };
            }
            acc[key].count++;
            return acc;
        }, {});

        const screens = [...new Set(slots.map(s => s.screen_id))];

        // Bug #27 fix: append T00:00:00 so YYYY-MM-DD strings parse in local
        // time, not UTC midnight (which renders as the previous day in UTC- zones).
        const durationDays = data.dateRange
            ? Math.ceil(
                (new Date(data.dateRange.end   + 'T00:00:00') -
                 new Date(data.dateRange.start + 'T00:00:00'))
                / (1000 * 60 * 60 * 24)
              ) + 1
            : 0;

        return {
            totalCost,
            totalSlots: slots.length,
            totalImpressions,
            slots,
            byDateHour: Object.values(byDateHour),
            screenCount: screens.length,
            durationDays
        };
    }, [data.selectedSlots, data.dateRange]);

    const formatHour = (hour) => {
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:00 ${suffix}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    // Disable confirm while submitting OR terms not agreed
    const confirmDisabled = submitting || !termsAgreed;

    return (
        <div className="space-y-6">
            {/* Step Header */}
            <GlassCard className="border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">check_circle</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Step 5: Review &amp; Confirm</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Review your campaign details before submitting
                        </p>
                    </div>
                </div>
            </GlassCard>

            {/* Loop Visualisation Bar — MVP: static visual aid, not data-driven */}
            <LoopVisualisationBar />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Campaign Details */}
                    <GlassCard>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">campaign</span>
                            Campaign Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Campaign Name</p>
                                <p className="font-medium">{data.campaignName || 'Untitled Campaign'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Duration</p>
                                <p className="font-medium">{summary.durationDays} days</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Start Date</p>
                                <p className="font-medium">{formatDate(data.dateRange?.start)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">End Date</p>
                                <p className="font-medium">{formatDate(data.dateRange?.end)}</p>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Placement Summary */}
                    <GlassCard>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">tv</span>
                            Placement Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                                <p className="text-3xl font-black text-primary">{summary.screenCount}</p>
                                <p className="text-xs text-slate-500">Screens</p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                                <p className="text-3xl font-black text-primary">{summary.totalSlots}</p>
                                <p className="text-xs text-slate-500">Total Slots</p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                                <p className="text-3xl font-black text-primary">{pricingService.formatImpressions(summary.totalImpressions)}</p>
                                <p className="text-xs text-slate-500">Est. Impressions</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-500">Slot Distribution</p>
                            <div className="flex flex-wrap gap-2">
                                {summary.byDateHour.slice(0, 10).map((item, idx) => {
                                    const tier = pricingService.getTrafficTier(item.hour);
                                    return (
                                        <div
                                            key={idx}
                                            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm"
                                        >
                                            <span className="font-medium">{formatDate(item.date)}</span>
                                            <span className="mx-1 text-slate-400">@</span>
                                            <span>{formatHour(item.hour)}</span>
                                            <span className="ml-2 text-primary font-bold">×{item.count}</span>
                                        </div>
                                    );
                                })}
                                {summary.byDateHour.length > 10 && (
                                    <span className="px-3 py-2 text-sm text-slate-400">
                                        +{summary.byDateHour.length - 10} more
                                    </span>
                                )}
                            </div>
                        </div>
                    </GlassCard>

                    {/* Creative Preview */}
                    <GlassCard>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">image</span>
                            Creative Preview
                        </h3>
                        <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden max-w-lg">
                            <img
                                src={data.creativeUrl}
                                alt="Campaign creative"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </GlassCard>
                </div>

                {/* Right Column - Price & Actions */}
                <div className="space-y-6">
                    <GlassCard className="sticky top-4">
                        <h3 className="font-bold text-lg mb-4">Order Summary</h3>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">{summary.totalSlots} slots</span>
                                <span>{pricingService.formatPrice(summary.totalCost)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Platform fee</span>
                                <span className="text-emerald-500">Included</span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-end">
                                    <span className="font-medium">Total</span>
                                    <span className="text-3xl font-black text-primary">
                                        {pricingService.formatPrice(summary.totalCost)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 text-right mt-1">
                                    ~{pricingService.formatImpressions(summary.totalImpressions)} impressions
                                </p>
                            </div>
                        </div>

                        {/* Impact Summary — above confirm button */}
                        <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider">Frequency / Hour</span>
                                <span className="text-sm font-black text-primary">
                                    12x <span className="text-xs font-normal text-slate-400">Every 5 mins</span>
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider">Total Slots</span>
                                <span className="text-sm font-black text-blue-500">{summary.totalSlots}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider">Est. Impressions</span>
                                <span className="text-sm font-black text-indigo-500">{pricingService.formatImpressions(summary.totalImpressions)}</span>
                            </div>
                        </div>

                        {/* Terms */}
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 mb-4">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    data-testid="terms-checkbox"
                                    className="mt-1 accent-primary"
                                    checked={termsAgreed}
                                    onChange={(e) => setTermsAgreed(e.target.checked)}
                                />
                                <span className="text-xs text-slate-500">
                                    I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Advertising Policy</a>
                                </span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="relative space-y-3">
                            <button
                                onClick={() => {
                                    if (!termsAgreed) {
                                        alert('Please agree to the Terms of Service to proceed.');
                                        return;
                                    }
                                    onConfirm();
                                }}
                                disabled={confirmDisabled}
                                data-testid="btn-submit-campaign"
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Booking…
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Confirm Booking
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onPrev}
                                disabled={submitting}
                                className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Go Back
                            </button>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-400 text-center">
                                Need help? <a href="#" className="text-primary hover:underline">Contact Support</a>
                            </p>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}

export default Step5ReviewConfirm;
