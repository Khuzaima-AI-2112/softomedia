/**
 * TrafficTierBadge Component
 * Visual indicator for traffic tier levels
 */


const tierStyles = {
    veryLow: {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-300 dark:border-slate-600',
        dot: 'bg-slate-400'
    },
    low: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-400'
    },
    medium: {
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-400'
    },
    high: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/30',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-400'
    }
};

const tierLabels = {
    veryLow: 'Very Low',
    low: 'Low',
    medium: 'Medium',
    high: 'High'
};

function TrafficTierBadge({ tier, showLabel = true, size = 'default' }) {
    const style = tierStyles[tier] || tierStyles.medium;
    const label = tierLabels[tier] || 'Unknown';

    const sizeClasses = size === 'small'
        ? 'px-1.5 py-0.5 text-[10px]'
        : 'px-2 py-1 text-xs';

    const dotSize = size === 'small' ? 'size-1.5' : 'size-2';

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${sizeClasses} ${style.bg} ${style.text} ${style.border}`}
            title={`Traffic Tier: ${label}`}
        >
            <span className={`${dotSize} rounded-full ${style.dot}`}></span>
            {showLabel && <span>{label}</span>}
        </span>
    );
}

export default TrafficTierBadge;
