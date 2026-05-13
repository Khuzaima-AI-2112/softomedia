import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PriceSummary } from '../../../components/PriceDisplay';
import pricingService from '../../../services/PricingService';
import '../../../design-tokens.css';

function Step5ReviewConfirm({ data, onConfirm, onPrev }) {
    const navigate = useNavigate();
    const [termsChecked, setTermsChecked] = useState(true);

    const summary = useMemo(() => {
        const slots = data.selectedSlots || [];
        const totalCost = slots.reduce((sum, s) => sum + (s.price || 0), 0);
        let totalImpressions = 0;
        slots.forEach(s => { totalImpressions += pricingService.getEstimatedImpressions(s.screen_id, s.hour); });
        const byDateHour = slots.reduce((acc, slot) => {
            const key = `${slot.date}_${slot.hour}`;
            if (!acc[key]) acc[key] = { date: slot.date, hour: slot.hour, count: 0 };
            acc[key].count++;
            return acc;
        }, {});
        const screens = [...new Set(slots.map(s => s.screen_id))];
        return {
            totalCost, totalSlots: slots.length, totalImpressions,
            byDateHour: Object.values(byDateHour),
            screenCount: screens.length,
            durationDays: data.dateRange
                ? Math.ceil((new Date(data.dateRange.end) - new Date(data.dateRange.start)) / (1000 * 60 * 60 * 24)) + 1
                : 0,
        };
    }, [data.selectedSlots, data.dateRange]);

    const formatHour = (hour) => {
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${h}:00 ${suffix}`;
    };
    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const handleConfirm = () => {
        if (!termsChecked) { alert('Please agree to the Terms of Service to proceed.'); return; }
        onConfirm();
    };

    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.25rem 1.375rem',
    };

    const metaLabel = {
        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
        color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 3,
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', paddingBottom: '2rem', alignItems: 'start' }}>

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Campaign details */}
                <div style={card}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: '0.875rem' }}>Campaign Details</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                        {[
                            { label: 'Campaign Name', value: data.campaignName || 'Untitled Campaign' },
                            { label: 'Duration',       value: `${summary.durationDays} days` },
                            { label: 'Start Date',     value: formatDate(data.dateRange?.start) },
                            { label: 'End Date',       value: formatDate(data.dateRange?.end) },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p style={metaLabel}>{label}</p>
                                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Placement summary */}
                <div style={card}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: '0.875rem' }}>Placement Summary</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                        {[
                            { value: summary.screenCount, label: 'Screens' },
                            { value: summary.totalSlots,  label: 'Total Slots' },
                            { value: pricingService.formatImpressions(summary.totalImpressions), label: 'Est. Impressions' },
                        ].map(({ value, label }) => (
                            <div key={label} style={{
                                padding: '0.875rem', borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-bg-hover)', textAlign: 'center',
                            }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'var(--font-bold)', color: 'var(--color-primary)', margin: 0, lineHeight: 1.1 }}>{value}</p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{label}</p>
                            </div>
                        ))}
                    </div>
                    {/* Slot distribution chips */}
                    <p style={{ ...metaLabel, marginBottom: '0.5rem' }}>Slot Distribution</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {summary.byDateHour.slice(0, 10).map((item, i) => (
                            <span key={i} style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-bg-hover)',
                                border: '1px solid var(--color-border-light)',
                                fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
                            }}>
                                {formatDate(item.date)} @ {formatHour(item.hour)}
                                <span style={{ marginLeft: 4, fontWeight: 'var(--font-bold)', color: 'var(--color-primary)' }}>×{item.count}</span>
                            </span>
                        ))}
                        {summary.byDateHour.length > 10 && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', padding: '4px 6px' }}>+{summary.byDateHour.length - 10} more</span>
                        )}
                    </div>
                </div>

                {/* Creative preview */}
                <div style={card}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>Creative Preview</p>
                    <div style={{ aspectRatio: '16/9', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxWidth: 480, backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
                        <img src={data.creativeUrl} alt="Campaign creative" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                </div>
            </div>

            {/* Right column — sticky order summary + actions */}
            <div style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{
                    ...card,
                    borderTop: '3px solid var(--color-border)',
                    padding: '1.25rem',
                }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Order Summary</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{summary.totalSlots} slots</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>{pricingService.formatPrice(summary.totalCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Platform fee</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-success)' }}>Included</span>
                        </div>
                        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>Total</span>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'var(--font-bold)', color: 'var(--color-primary)', margin: 0, lineHeight: 1.1 }}>{pricingService.formatPrice(summary.totalCost)}</p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>~{pricingService.formatImpressions(summary.totalImpressions)} impressions</p>
                            </div>
                        </div>
                    </div>

                    {/* Terms */}
                    <div style={{
                        padding: '0.625rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-hover)',
                        border: '1px solid var(--color-border-light)',
                        marginBottom: '1rem',
                    }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                data-testid="terms-checkbox"
                                checked={termsChecked}
                                onChange={e => setTermsChecked(e.target.checked)}
                                style={{ marginTop: 2, accentColor: 'var(--color-primary)', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                                I agree to the{' '}
                                <a href="#" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Terms of Service</a>
                                {' '}and{' '}
                                <a href="#" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Advertising Policy</a>
                            </span>
                        </label>
                    </div>

                    {/* Actions — confirm dominant, back ghost */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                            onClick={handleConfirm}
                            data-testid="confirm-booking-btn"
                            style={{
                                width: '100%', padding: '0.875rem 1rem',
                                backgroundColor: 'var(--color-primary)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                                cursor: 'pointer', boxShadow: 'var(--shadow-md)',
                                transition: 'background-color var(--transition-fast)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                        >Confirm Booking</button>

                        {/* Ghost back button — text-only, low visual weight */}
                        <button
                            onClick={onPrev}
                            style={{
                                width: '100%', padding: '0.5rem',
                                background: 'none', border: 'none',
                                fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
                                cursor: 'pointer', borderRadius: 'var(--radius-md)',
                                transition: 'color var(--transition-fast)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                        >← Go Back</button>
                    </div>

                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '0.875rem' }}>
                        Need help?{' '}<a href="#" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Contact Support</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Step5ReviewConfirm;
