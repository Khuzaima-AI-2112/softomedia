import winston from 'winston';

// Standardized log format for BigQuery/Cloud Logging compatibility (JSON)
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const transports = [
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production'
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
    })
];

// Only use file logging in local development if needed, otherwise skip for Cloud Run
if (process.env.NODE_ENV !== 'production' && !process.env.K_SERVICE) {
    transports.push(
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    );
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'ad-server',
        environment: process.env.NODE_ENV || 'development',
        // Read at log time, so it names the project the server is actually connected to.
        get project_id() {
            return process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'unknown';
        },
    },
    transports
});

// Middleware for request logging
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            user_agent: req.get('user-agent')
        });
    });
    next();
};

export default logger;
