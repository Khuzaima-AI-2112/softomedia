import React, { useState } from 'react';

function AdSchedule({ schedule, onChange }) {
    const [rules, setRules] = useState(schedule?.rules || []);
    const [enabled, setEnabled] = useState(schedule?.enabled || false);

    const handleEnabledChange = (e) => {
        const isEnabled = e.target.checked;
        setEnabled(isEnabled);
        onChange({ enabled: isEnabled, rules });
    };

    const addRule = () => {
        const newRule = {
            id: `rule_${Date.now()}`,
            days: ['monday'],
            time_ranges: [{ start: '09:00', end: '17:00' }]
        };
        const newRules = [...rules, newRule];
        setRules(newRules);
        onChange({ enabled, rules: newRules });
    };

    const removeRule = (ruleId) => {
        const newRules = rules.filter(r => r.id !== ruleId);
        setRules(newRules);
        onChange({ enabled, rules: newRules });
    };

    const updateRule = (ruleId, field, value) => {
        const newRules = rules.map(r =>
            r.id === ruleId ? { ...r, [field]: value } : r
        );
        setRules(newRules);
        onChange({ enabled, rules: newRules });
    };

    const updateTimeRange = (ruleId, rangeIndex, field, value) => {
        const newRules = rules.map(r => {
            if (r.id === ruleId) {
                const newTimeRanges = [...r.time_ranges];
                newTimeRanges[rangeIndex] = { ...newTimeRanges[rangeIndex], [field]: value };
                return { ...r, time_ranges: newTimeRanges };
            }
            return r;
        });
        setRules(newRules);
        onChange({ enabled, rules: newRules });
    };

    const dayPresets = [
        { label: 'Mondays - Fridays', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
        { label: 'Saturdays - Sundays', days: ['saturday', 'sunday'] },
        { label: 'Every Day', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }
    ];

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Enable Checkbox */}
            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={handleEnabledChange}
                        style={{ marginRight: '0.5rem', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontWeight: '500' }}>Enable Ad Scheduling</span>
                </label>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                    Control when your ad plays with day and time rules
                </p>
            </div>

            {enabled && (
                <div style={{
                    backgroundColor: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb'
                }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                        Schedule Rules
                    </h3>

                    {rules.length === 0 && (
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>
                            No schedule rules. Click "Add" to create your first rule.
                        </p>
                    )}

                    {rules.map((rule, index) => (
                        <div
                            key={rule.id}
                            style={{
                                backgroundColor: '#fff',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '0.75rem',
                                border: '1px solid #e5e7eb'
                            }}
                        >
                            {/* Day Selector */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    marginBottom: '0.25rem',
                                    color: '#6b7280'
                                }}>
                                    Days
                                </label>
                                <select
                                    value={rule.days.join(',')}
                                    onChange={(e) => {
                                        const preset = dayPresets.find(p => p.days.join(',') === e.target.value);
                                        if (preset) {
                                            updateRule(rule.id, 'days', preset.days);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {dayPresets.map(preset => (
                                        <option key={preset.label} value={preset.days.join(',')}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Time Ranges */}
                            {rule.time_ranges.map((range, rangeIndex) => (
                                <div
                                    key={rangeIndex}
                                    style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        alignItems: 'center',
                                        marginBottom: '0.5rem'
                                    }}
                                >
                                    <input
                                        type="time"
                                        value={range.start}
                                        onChange={(e) => updateTimeRange(rule.id, rangeIndex, 'start', e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>to</span>
                                    <input
                                        type="time"
                                        value={range.end}
                                        onChange={(e) => updateTimeRange(rule.id, rangeIndex, 'end', e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                            ))}

                            {/* Delete Button */}
                            <button
                                onClick={() => removeRule(rule.id)}
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    backgroundColor: 'transparent',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    width: '100%'
                                }}
                            >
                                ✕ Remove Rule
                            </button>
                        </div>
                    ))}

                    {/* Add Rule Button */}
                    <button
                        onClick={addRule}
                        style={{
                            padding: '0.625rem',
                            backgroundColor: '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            width: '100%',
                            marginTop: '0.5rem'
                        }}
                    >
                        + Add Rule
                    </button>
                </div>
            )}
        </div>
    );
}

export default AdSchedule;
