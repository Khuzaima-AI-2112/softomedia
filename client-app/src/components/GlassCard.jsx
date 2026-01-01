import React from 'react';

const GlassCard = ({ children, style = {}, className = '' }) => {
    return (
        <div
            className={className}
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                borderRadius: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                padding: '1.5rem',
                ...style
            }}
        >
            {children}
        </div>
    );
};

export default GlassCard;
