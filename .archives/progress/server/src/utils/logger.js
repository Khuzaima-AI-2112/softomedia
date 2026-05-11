// Zero-dependency Logger
// Formats logs as JSON for Google Cloud Logging

export const logger = {
    info: (message, meta = {}) => {
        console.log(JSON.stringify({
            severity: 'INFO',
            message,
            timestamp: new Date().toISOString(),
            service: 'ad-server',
            ...meta
        }));
    },
    warn: (message, meta = {}) => {
        console.log(JSON.stringify({
            severity: 'WARNING',
            message,
            timestamp: new Date().toISOString(),
            service: 'ad-server',
            ...meta
        }));
    },
    error: (message, meta = {}) => {
        console.error(JSON.stringify({
            severity: 'ERROR',
            message,
            timestamp: new Date().toISOString(),
            service: 'ad-server',
            ...meta
        }));
    }
};
