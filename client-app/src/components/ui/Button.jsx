/**
 * Button — Base UI atom
 *
 * Variants:   primary | secondary | ghost | destructive
 * Sizes:      sm | md | lg
 * States:     disabled, loading
 *
 * Usage:
 *   <Button variant="primary">Save</Button>
 *   <Button variant="destructive" size="sm">Delete</Button>
 *   <Button variant="ghost" loading>Saving…</Button>
 */
import { Loader2 } from 'lucide-react';

const sizeClasses = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

const variantClasses = {
  primary: [
    'bg-[var(--color-primary)] text-white',
    'hover:bg-[var(--color-primary-hover)]',
    'active:bg-[var(--color-primary-active)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  secondary: [
    'bg-[var(--color-surface)] text-[var(--color-text)]',
    'border border-[var(--color-border)]',
    'hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border)]',
    'active:bg-[var(--color-surface-3)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  ghost: [
    'bg-transparent text-[var(--color-text-muted)]',
    'hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]',
    'active:bg-[var(--color-surface-3)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  destructive: [
    'bg-transparent text-[var(--color-destructive)]',
    'border border-[var(--color-destructive)]',
    'hover:bg-[var(--color-destructive)] hover:text-white',
    'active:bg-[var(--color-destructive-active)] active:border-[var(--color-destructive-active)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-destructive)] focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const base = [
    'inline-flex items-center justify-center',
    'font-medium rounded-[var(--radius-md)]',
    'whitespace-nowrap select-none',
    'transition-colors duration-150',
    sizeClasses[size] ?? sizeClasses.md,
    variantClasses[variant] ?? variantClasses.primary,
    className,
  ].join(' ');

  return (
    <button
      type={type}
      className={base}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Loader2
          size={14}
          className="animate-spin flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export default Button;
