/**
 * Performance Middleware
 * Handles ETag and Cache-Control headers
 */
export const cacheControl = (seconds) => {
    return (req, res, next) => {
        if (req.method === 'GET') {
            res.set('Cache-Control', `public, max-age=${seconds}`);
        } else {
            res.set('Cache-Control', 'no-store');
        }
        next();
    };
};

export const etagSupport = (req, res, next) => {
    // Basic ETag support (Express handles this mostly, but we can customize)
    next();
};
