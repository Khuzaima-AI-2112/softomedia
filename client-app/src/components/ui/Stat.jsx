/**
 * Stat — KPI card atom
 *
 * Displays a metric with an optional trend indicator.
 * Uses surface elevation for depth — NO colored side borders or accents.
 *
 * Props:
 *   label       string   Metric name
 *   value       string   The large displayed number/value
 *   trend       number   Change value (positive = up, negative = down, 0/null = flat)
 *   trendLabel  string   e.g. "vs last month"
 *   icon        node     Optional Lucide icon component
 *   loading     boolean  Show skeleton state
 *
 * Usage:
 *   <Stat label="Active Campaigns" value="4" trend={1} trendLabel="new this week" />
 *   <Stat label="Total Spent" value="$1,250" trend={-3.2} trendLabel="vs last month" />
 *   <Stat label="Screens Online" value="3" loading />
 */
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function Stat({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  loading = false,
  className = '',
  ...props
}) {
  const hasTrend = trend !== null && trend !== undefined;
  const isUp   = hasTrend && trend > 0;
  const isDown = hasTrend && trend < 0;
  const isFlat = hasTrend && trend === 0;

  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendColor = isUp
    ? 'text-[var(--color-success)]'
    : isDown
    ? 'text-[var(--color-error)]'
    : 'text-[var(--color-text-faint)]';

  if (loading) {
    return (
      <div
        className={[
          'bg-[var(--color-surface)] border border-[rgba(17,24,39,0.08)]',
          'rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',
          'p-[var(--spacing-5)]',
          className,
        ].join(' ')}
        aria-busy="true"
        {...props}
      >
        <div className="skeleton h-4 w-24 mb-3" />
        <div className="skeleton h-8 w-16 mb-2" />
        <div className="skeleton h-3 w-20" />
      </div>
    );
  }

  return (
    <div
      className={[
        'bg-[var(--color-surface)] border border-[rgba(17,24,39,0.08)]',
        'rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',
        'p-[var(--spacing-5)]',
        className,
      ].join(' ')}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-[var(--color-text-muted)] leading-none mb-2">
          {label}
        </p>
        {Icon && (
          <span className="text-[var(--color-text-faint)] flex-shrink-0" aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
      </div>

      <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums leading-none mb-1">
        {value}
      </p>

      {hasTrend && (
        <div className={['flex items-center gap-1 text-xs', trendColor].join(' ')}>
          <TrendIcon size={12} aria-hidden="true" />
          <span>
            {isUp ? '+' : ''}{trend}
            {trendLabel && <span className="text-[var(--color-text-faint)] ml-1">{trendLabel}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

export default Stat;
