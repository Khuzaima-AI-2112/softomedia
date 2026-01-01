// Security Middleware
// XSS prevention and input sanitization

import { body } from 'express-validator';

/**
 * Sanitize string inputs to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 */
export const sanitizeString = (value) => {
    if (typeof value !== 'string') return value;

    // Remove HTML tags
    let sanitized = value.replace(/<[^>]*>/g, '');

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>'"]/g, '');

    return sanitized.trim();
};

/**
 * Middleware to add security headers
 */
export const securityHeaders = (req, res, next) => {
    // Prevent XSS attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Security Policy
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    );

    next();
};

/**
 * Middleware to limit request body size
 */
export const requestSizeLimit = '10mb'; // For express.json({ limit: requestSizeLimit })
