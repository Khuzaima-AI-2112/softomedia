/**
 * EmptyState — Designed empty/zero-data state
 *
 * Never renders just "No items." — always includes:
 *   - An icon (from Lucide) or custom illustration
 *   - A warm heading
 *   - An explanatory body sentence
 *   - An optional primary action button
 *
 * Props:
 *   icon        Lucide icon component  (default: Inbox)
 *   title       string                 Heading text
 *   description string                 Body text
 *   action      node                   Optional CTA button or link
 *   compact     boolean                Smaller padding for inline contexts
 *
 * Usage:
 *   <EmptyState
 *     icon={Monitor}
 *     title="No screens registered yet"
 *     description="Add your first screen to start broadcasting."
 *     action={<Button variant="primary" onClick={...}>Add Screen</Button>}
 *   />
 */
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  compact = false,
  className = '',
  ...props
}) {
  return (
    <div
      className={[
        'flex flex-col items-center text-center',
        compact ? 'py-[var(--spacing-8)] px-[var(--spacing-4)]' : 'py-[var(--spacing-16)] px-[var(--spacing-8)]',
        className,
      ].join(' ')}
      role="status"
      aria-live="polite"
      {...props}
    >
      <span
        className="text-[var(--color-text-faint)] mb-[var(--spacing-4)]"
        aria-hidden="true"
      >
        <Icon size={compact ? 32 : 40} strokeWidth={1.5} />
      </span>

      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-[var(--spacing-1)]">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--color-text-muted)] max-w-[36ch] mb-[var(--spacing-5)]">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-auto">
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
