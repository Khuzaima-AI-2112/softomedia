/**
 * Badge — Semantic status indicator
 *
 * Variants: success | warning | error | neutral | info | primary
 * Size:     sm | md
 * Dot:      show a colored dot before the label
 *
 * Usage:
 *   <Badge variant="success">Live</Badge>
 *   <Badge variant="warning" dot>Pending</Badge>
 *   <Badge variant="error" size="sm">Rejected</Badge>
 */

const variantMap = {
  success: {
    bg:   'bg-[var(--color-success-light)]',
    text: 'text-[var(--color-success-text)]',
    dot:  'bg-[var(--color-success)]',
  },
  warning: {
    bg:   'bg-[var(--color-warning-light)]',
    text: 'text-[var(--color-warning-text)]',
    dot:  'bg-[var(--color-warning)]',
  },
  error: {
    bg:   'bg-[var(--color-error-light)]',
    text: 'text-[var(--color-error-text)]',
    dot:  'bg-[var(--color-error)]',
  },
  neutral: {
    bg:   'bg-[var(--color-surface-2)]',
    text: 'text-[var(--color-text-muted)]',
    dot:  'bg-[var(--color-text-faint)]',
  },
  info: {
    bg:   'bg-[var(--color-info-light)]',
    text: 'text-[var(--color-info-text)]',
    dot:  'bg-[var(--color-info)]',
  },
  primary: {
    bg:   'bg-[var(--color-primary-light)]',
    text: 'text-[var(--color-primary-text)]',
    dot:  'bg-[var(--color-primary)]',
  },
};

const sizeMap = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) {
  const v = variantMap[variant] ?? variantMap.neutral;
  const s = sizeMap[size] ?? sizeMap.md;

  return (
    <span
      className={[
        'inline-flex items-center font-medium',
        'rounded-[var(--radius-full)]',
        v.bg, v.text, s,
        className,
      ].join(' ')}
      {...props}
    >
      {dot && (
        <span
          className={['w-1.5 h-1.5 rounded-full flex-shrink-0', v.dot].join(' ')}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
