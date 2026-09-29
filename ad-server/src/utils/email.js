const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether a submitted email is valid once the spaces around it are trimmed. */
export function isValidEmail(value) {
    return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}
