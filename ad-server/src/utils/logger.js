// Logger Utility
// Structured logging with Winston

import winston from 'winston';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create Winston logger
const logger = winston.createLogger({
    level: isDevelopment ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'ad-server' },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: isDevelopment
                ? winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
                : winston.format.json()
        })
    ]
});

// Add Cloud Logging transport in production
if (!isDevelopment) {
    // In production, logs go to stdout/stderr and are picked up by Cloud Logging
    logger.info('Running in production mode - logs will be sent to Cloud Logging');
}

/**
 * Log levels:
 * - error: Error messages
 * - warn: Warning messages
 * - info: Informational messages
 * - http: HTTP request logs
 * - debug: Debug messages (development only)
 */

export default logger;

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });

    next();
};
