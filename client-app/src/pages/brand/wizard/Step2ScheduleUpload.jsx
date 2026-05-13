import { CalendarDays, Tv } from 'lucide-react';
import '../../../design-tokens.css';

function DateRangePicker({ start, end, onChangeStart, onChangeEnd, minStart }) {
    const inputBase = {
        flex: 1, padding: '0.625rem 0.875rem',
        border: 'none', outline: 'none',
        fontSize: 'var(--text-sm)', backgroundColor: 'transparent',
        color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', minWidth: 0,
    };
    return (
        <div style={{
            display: 'flex', alignItems: 'stretch',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-card)',
            overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
        }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.375rem 0.875rem 0.5rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Start</label>
                <input type="date" value={start || ''} min={minStart} onChange={e => onChangeStart(e.target.value)} style={inputBase} data-testid="campaign-start-date-input" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.625rem', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}>
                <CalendarDays size={14} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.375rem 0.875rem 0.5rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>End</label>
                <input type="date" value={end || ''} min={start || minStart} onChange={e => onChangeEnd(e.target.value)} style={inputBase} data-testid="campaign-end-date-input" />
            </div>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>{label}</label>
            {children}
            {hint && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{hint}</p>}
        </div>
    );
}

const Step2ScheduleUpload = ({ data, updateData, onNext, onPrev }) => {
    const today = new Date().toISOString().split('T')[0];

    const getDuration = () => {
        if (!data.dateRange?.start || !data.dateRange?.end) return 0;
        return Math.max(1, Math.ceil((new Date(data.dateRange.end) - new Date(data.dateRange.start)) / (1000 * 60 * 60 * 24)) + 1);
    };
    const duration = getDuration();

    const handleContinue = () => {
        if (!data.campaignName) updateData({ campaignName: 'Untitled Campaign' });
        onNext();
    };

    const cardStyle = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.25rem 1.375rem',
    };

    const inputStyle = {
        width: '100%', padding: '0.625rem 0.875rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-body)',
        outline: 'none', boxSizing: 'border-box',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '5rem' }}>

            {/* Campaign Name — full-width row */}
            <div style={cardStyle}>
                <Field label="Campaign Name" hint="Choose a memorable name for your campaign">
                    <input
                        type="text"
                        data-testid="campaign-name-input"
                        value={data.campaignName || ''}
                        onChange={e => updateData({ campaignName: e.target.value })}
                        placeholder="e.g., Summer Sale 2026"
                        style={inputStyle}
                    />
                </Field>
            </div>

            {/* Campaign Budget — full-width row */}
            <div style={cardStyle}>
                <Field label="Campaign Budget" hint="Set your maximum spending limit">
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                            color: 'var(--color-text-tertiary)', pointerEvents: 'none',
                        }}>$</span>
                        <input
                            type="number"
                            data-testid="campaign-budget-input"
                            value={data.budget || 1000}
                            onChange={e => updateData({ budget: parseInt(e.target.value) || 0 })}
                            min="100" step="100"
                            style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                        />
                    </div>
                </Field>
            </div>

            {/* Date range — inline joined picker */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>Campaign Duration</label>
                    {duration > 0 && (
                        <span style={{
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                            color: 'var(--color-primary)',
                            backgroundColor: 'rgba(99,102,241,0.08)',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                        }}>{duration} day{duration !== 1 ? 's' : ''}</span>
                    )}
                </div>
                <DateRangePicker
                    start={data.dateRange?.start}
                    end={data.dateRange?.end}
                    minStart={today}
                    onChangeStart={v => updateData({ dateRange: { ...data.dateRange, start: v } })}
                    onChangeEnd={v => updateData({ dateRange: { ...data.dateRange, end: v } })}
                />
            </div>

            {/* Screens summary */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-hover)', padding: '0.875rem 1.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0, backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Tv size={16} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                            {(data.selectedScreens || []).length} Screen{(data.selectedScreens || []).length !== 1 ? 's' : ''} Selected
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                            {(data.selectedStores || []).length} Store{(data.selectedStores || []).length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <button onClick={onPrev} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}>
                    Change →
                </button>
            </div>

            {/* Sticky nav footer */}
            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
                backgroundColor: 'var(--color-bg-card)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                padding: '0.875rem 2.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <button
                    onClick={onPrev}
                    style={{
                        height: 38, padding: '0 1.125rem',
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
                        color: 'var(--color-text-primary)', cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                >← Back</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>Campaign Duration</p>
                        <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>{duration} Day{duration !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={handleContinue}
                        disabled={duration < 1}
                        data-testid="step-2-next-btn"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                            height: 38, padding: '0 1.25rem',
                            backgroundColor: 'var(--color-primary)', color: '#fff',
                            border: 'none', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                            cursor: duration < 1 ? 'not-allowed' : 'pointer',
                            opacity: duration < 1 ? 0.5 : 1,
                            transition: 'all var(--transition-fast)', boxShadow: 'var(--shadow-md)',
                        }}
                        onMouseEnter={e => { if (duration >= 1) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    >Select Time Slots →</button>
                </div>
            </footer>
        </div>
    );
};

export default Step2ScheduleUpload;
