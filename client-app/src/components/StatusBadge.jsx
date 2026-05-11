import React from 'react';
import '../design-tokens.css';

/**
 * StatusBadge - Pill-shaped status indicator
 * Part of the Industrial Premium design system
 * 
 * @param {string} status - Status type: 'active', 'offline', 'pending', 'invited'
 * @param {string} text - Optional custom text (defaults to capitalized status)
 * @param {string} className - Additional CSS classes
 */
function StatusBadge({ status, text, className = '' }) {
    const statusConfig = {
        active: {
            backgroundColor: 'var(--color-success-light)',
            color: '#03543f',
            text: 'Active',
        },
        online: {
            backgroundColor: 'var(--color-success-light)',
            color: '#03543f',
            text: 'Online',
        },
        offline: {
            backgroundColor: 'var(--color-error-light)',
            color: '#9b1c1c',
            text: 'Offline',
        },
        pending: {
            backgroundColor: 'var(--color-warning-light)',
            color: '#92400e',
            text: 'Pending',
        },
        invited: {
            backgroundColor: '#f3f4f6',
            color: '#4b5563',
            text: 'Invited',
        },
        paused: {
            backgroundColor: '#f3f4f6',
            color: '#4b5563',
            text: 'Paused',
        },
    };

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    const displayText = text || config.text;

    const badgeStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-medium)',
        backgroundColor: config.backgroundColor,
        color: config.color,
        textTransform: 'capitalize',
        transition: 'all var(--transition-fast)',
    };

    return (
        <span className={`status-badge ${className}`} style={badgeStyles}>
            {/* Optional status dot */}
            <span
                style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: config.color,
                    marginRight: 'var(--space-2)',
                    display: 'inline-block',
                }}
            />
            {displayText}
        </span>
    );
}

export default StatusBadge;
