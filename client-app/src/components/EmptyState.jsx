import React from 'react';
import '../design-tokens.css';

/**
 * EmptyState - State 14: Day Zero Dashboard
 * Displays when user has no data/content
 * Part of the Industrial Premium design system
 * 
 * @param {string} title - Main heading
 * @param {string} message - Descriptive message
 * @param {string} ctaText - Call-to-action button text
 * @param {Function} onCtaClick - CTA button click handler
 * @param {string} illustration - Optional illustration/icon
 */
function EmptyState({
    title = 'Ready to Activate',
    message = 'Pair your first screen to start earning.',
    ctaText = 'Pair Screen',
    onCtaClick,
    illustration = '📺',
}) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-16)',
                textAlign: 'center',
                minHeight: '400px',
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
            }}
        >
            {/* Hero Illustration */}
            <div
                style={{
                    fontSize: '4rem',
                    marginBottom: 'var(--space-6)',
                    opacity: 0.9,
                }}
            >
                {illustration}
            </div>

            {/* Title */}
            <h2
                style={{
                    fontSize: 'var(--text-3xl)',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-4)',
                }}
            >
                {title}
            </h2>

            {/* Message */}
            <p
                style={{
                    fontSize: 'var(--text-lg)',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-8)',
                    maxWidth: '500px',
                    lineHeight: '1.6',
                }}
            >
                {message}
            </p>

            {/* CTA Button */}
            {onCtaClick && (
                <button
                    onClick={onCtaClick}
                    style={{
                        padding: 'var(--space-4) var(--space-8)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--font-semibold)',
                        color: 'white',
                        backgroundColor: 'var(--color-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)',
                        boxShadow: 'var(--shadow-md)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                >
                    {ctaText}
                </button>
            )}
        </div>
    );
}

export default EmptyState;
