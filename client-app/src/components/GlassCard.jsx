import React from 'react';
import '../design-tokens.css';

/**
 * GlassCard - Reusable card component with glass morphism effect
 * Part of the Industrial Premium design system
 * 
 * @param {string} title - Optional title displayed at top of card
 * @param {React.ReactNode} children - Card content
 * @param {string} className - Additional CSS classes
 * @param {boolean} glass - Enable glass morphism effect (default: false)
 * @param {React.CSSProperties} style - Inline styles
 */
function GlassCard({ title, children, className = '', glass = false, style = {} }) {
    const baseStyles = {
        backgroundColor: 'var(--color-bg-card)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        transition: 'box-shadow var(--transition-base)',
    };

    const glassStyles = glass ? {
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: 'var(--shadow-glass)',
    } : {};

    const combinedStyles = {
        ...baseStyles,
        ...glassStyles,
        ...style,
    };

    return (
        <div className={`glass-card-component ${className}`} style={combinedStyles}>
            {title && (
                <h3 style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    marginBottom: 'var(--space-4)',
                    color: 'var(--color-text-primary)',
                }}>
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}

export default GlassCard;
