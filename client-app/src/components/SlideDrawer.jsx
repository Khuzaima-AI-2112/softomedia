import React, { useEffect } from 'react';
import '../design-tokens.css';

/**
 * SlideDrawer - Reusable slide-out drawer from right side
 * Part of the Industrial Premium design system
 * 
 * @param {boolean} isOpen - Controls drawer visibility
 * @param {Function} onClose - Called when drawer should close
 * @param {string} title - Drawer title
 * @param {React.ReactNode} children - Drawer content
 * @param {string} width - Drawer width (default: '500px')
 */
function SlideDrawer({ isOpen, onClose, title, children, width = '500px' }) {
    // Close on ESC key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 'var(--z-overlay)',
                    animation: 'fadeIn 0.25s ease-out',
                }}
            />

            {/* Drawer */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: width,
                    maxWidth: '90vw',
                    backgroundColor: 'var(--color-bg-card)',
                    boxShadow: 'var(--shadow-2xl)',
                    zIndex: 'var(--z-drawer)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInRight 0.3s ease-out',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: 'var(--space-6)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <h2
                        style={{
                            fontSize: 'var(--text-xl)',
                            fontWeight: 'var(--font-semibold)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 'var(--text-2xl)',
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary)',
                            padding: 'var(--space-2)',
                            lineHeight: 1,
                            transition: 'color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                        aria-label="Close drawer"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 'var(--space-6)',
                    }}
                >
                    {children}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
            `}</style>
        </>
    );
}

export default SlideDrawer;
