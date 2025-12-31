import React, { useState, useEffect } from 'react';

function ScheduleTimeline({ campaigns, selectedDate }) {
    const [hoveredCampaign, setHoveredCampaign] = useState(null);
    const [hoveredPosition, setHoveredPosition] = useState({ x: 0, y: 0 });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Generate a color for each campaign
    const getCampaignColor = (index) => {
        const colors = [
            '#6366f1', // Indigo
            '#8b5cf6', // Purple
            '#ec4899', // Pink
            '#f59e0b', // Amber
            '#10b981', // Emerald
            '#3b82f6', // Blue
            '#ef4444', // Red
            '#14b8a6', // Teal
        ];
        return colors[index % colors.length];
    };

    // Check if campaign is scheduled for a specific hour
    const isCampaignScheduledAtHour = (campaign, hour) => {
        if (!campaign.schedule || !campaign.schedule.enabled) {
            return true; // Always on if no schedule
        }

        const date = selectedDate || new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = dayNames[date.getDay()];
        const hourString = hour.toString().padStart(2, '0') + ':00';

        for (const rule of campaign.schedule.rules || []) {
            // Check if current day matches
            const dayMatches = rule.days && rule.days.some(day =>
                day.toLowerCase() === currentDay
            );

            if (!dayMatches) continue;

            // Check if hour is within any time range
            for (const timeRange of rule.time_ranges || []) {
                const startHour = parseInt(timeRange.start.split(':')[0]);
                const endHour = parseInt(timeRange.end.split(':')[0]);

                if (hour >= startHour && hour <= endHour) {
                    return true;
                }
            }
        }

        return false;
    };

    const handleMouseEnter = (campaign, e) => {
        setHoveredCampaign(campaign);
        setHoveredPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (hoveredCampaign) {
            setHoveredPosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseLeave = () => {
        setHoveredCampaign(null);
    };

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Ad Schedule Timeline
            </h2>

            {campaigns.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                    No campaigns to display
                </p>
            ) : (
                <div style={{ position: 'relative' }}>
                    {/* Hour Headers */}
                    <div style={{ display: 'flex', marginBottom: '0.5rem', paddingLeft: '120px' }}>
                        {hours.map(hour => (
                            <div
                                key={hour}
                                style={{
                                    flex: 1,
                                    fontSize: '0.75rem',
                                    color: '#6b7280',
                                    textAlign: 'center',
                                    minWidth: '30px'
                                }}
                            >
                                {hour.toString().padStart(2, '0')}
                            </div>
                        ))}
                    </div>

                    {/* Campaign Rows */}
                    {campaigns.map((campaign, index) => {
                        const color = getCampaignColor(index);

                        return (
                            <div
                                key={campaign.campaign_id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '0.75rem',
                                    height: '40px'
                                }}
                            >
                                {/* Campaign Name */}
                                <div style={{
                                    width: '120px',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    paddingRight: '0.5rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {campaign.name}
                                </div>

                                {/* Timeline Bar */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    height: '100%',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '0.25rem',
                                    overflow: 'hidden'
                                }}>
                                    {hours.map(hour => {
                                        const isScheduled = isCampaignScheduledAtHour(campaign, hour);

                                        return (
                                            <div
                                                key={hour}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: isScheduled ? color : 'transparent',
                                                    borderRight: '1px solid #e5e7eb',
                                                    opacity: isScheduled ? 0.7 : 1,
                                                    transition: 'opacity 0.2s',
                                                    cursor: isScheduled ? 'pointer' : 'default',
                                                    minWidth: '30px'
                                                }}
                                                onMouseEnter={(e) => isScheduled && handleMouseEnter(campaign, e)}
                                                onMouseMove={handleMouseMove}
                                                onMouseLeave={handleMouseLeave}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Tooltip */}
                    {hoveredCampaign && (
                        <div style={{
                            position: 'fixed',
                            left: hoveredPosition.x + 10,
                            top: hoveredPosition.y + 10,
                            backgroundColor: '#1f2937',
                            color: '#fff',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            zIndex: 1000,
                            pointerEvents: 'none',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                {hoveredCampaign.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                {hoveredCampaign.schedule?.enabled
                                    ? 'Scheduled campaign'
                                    : 'Always on'}
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Legend:
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {campaigns.map((campaign, index) => (
                                <div key={campaign.campaign_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: getCampaignColor(index),
                                        opacity: 0.7,
                                        borderRadius: '2px'
                                    }} />
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        {campaign.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScheduleTimeline;
