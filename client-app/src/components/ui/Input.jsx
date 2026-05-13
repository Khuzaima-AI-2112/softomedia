/**
 * Input — Labelled form input atom
 *
 * Features:
 *   - Label always above the input (never inside)
 *   - Primary-color focus ring
 *   - Optional leading icon (left slot)
 *   - Optional trailing icon/action (right slot)
 *   - Error state: border + error message below
 *   - Hint text below the input
 *
 * Usage:
 *   <Input label="Campaign Name" placeholder="e.g. Summer Sale 2026" />
 *   <Input label="Budget" type="number" leadingIcon={<DollarSign size={14} />} />
 *   <Input label="Email" error="Email is required" />
 *   <Input label="Notes" hint="Optional — shown in the loop tooltip" />
 */
import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    trailingIcon,
    id,
    className = '',
    inputClassName = '',
    ...props
  },
  ref
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const hasError = Boolean(error);

  const wrapperClasses = [
    'relative flex items-center',
    'rounded-[var(--radius-md)]',
    'border',
    hasError
      ? 'border-[var(--color-error)] focus-within:ring-2 focus-within:ring-[var(--color-error)] focus-within:ring-offset-0'
      : 'border-[var(--color-border)] focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:ring-offset-0 focus-within:border-[var(--color-primary)]',
    'bg-[var(--color-surface)]',
    'transition-shadow duration-150',
  ].join(' ');

  const inputClasses = [
    'w-full bg-transparent outline-none',
    'text-sm text-[var(--color-text)]',
    'placeholder:text-[var(--color-text-faint)]',
    leadingIcon ? 'pl-9' : 'pl-3',
    trailingIcon ? 'pr-9' : 'pr-3',
    'py-2 h-9',
    inputClassName,
  ].join(' ');

  return (
    <div className={['flex flex-col gap-1', className].join(' ')}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--color-text)]"
        >
          {label}
        </label>
      )}

      <div className={wrapperClasses}>
        {leadingIcon && (
          <span
            className="absolute left-3 text-[var(--color-text-faint)] flex items-center"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${inputId}-error`
            : hint    ? `${inputId}-hint`
            : undefined
          }
          {...props}
        />

        {trailingIcon && (
          <span
            className="absolute right-3 text-[var(--color-text-faint)] flex items-center"
            aria-hidden="true"
          >
            {trailingIcon}
          </span>
        )}
      </div>

      {hasError && (
        <p
          id={`${inputId}-error`}
          className="text-xs text-[var(--color-error)] flex items-center gap-1"
          role="alert"
        >
          {error}
        </p>
      )}

      {hint && !hasError && (
        <p
          id={`${inputId}-hint`}
          className="text-xs text-[var(--color-text-faint)]"
        >
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
