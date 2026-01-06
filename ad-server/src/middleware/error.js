import logger from '../utils/logger.js';

/**
 * Global Error Handler Middleware
 * Catches all unhandled errors, logs them via structured logging,
 * and returns a safe JSON response to the client.
 */
export const errorHandler = (err, req, res, next) => {
    // 1. Log the error with full context
    logger.error('Unhandled Exception', {
        message: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        ip: req.ip,
        user_agent: req.get('user-agent'),
        // Add request ID if available in headers or req object
        request_id: req.headers['x-request-id'] || req.id
    });

    // 2. Determine status code (default to 500)
    const statusCode = err.status || err.statusCode || 500;

    // 3. Construct safe error response
    const response = {
        error: {
            message: statusCode === 500 ? 'Internal Server Error' : err.message,
            status: statusCode,
            // Only show detailed errors in non-production environments
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        },
        timestamp: new Date().toISOString()
    };

    // 4. Send JSON response
    res.status(statusCode).json(response);
};
