// Performance Middleware
// HTTP caching and optimization

/**
 * Add caching headers for static assets
 */
export const cacheControl = (maxAge = 3600) => (req, res, next) => {
    // Cache static assets for 1 hour by default
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    next();
};

/**
 * Add caching headers for API responses
 */
export const apiCacheControl = (req, res, next) => {
    // Don't cache API responses by default (can be overridden per route)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
};

/**
 * Add ETag support for playlist endpoint
 * Allows clients to cache playlist and only fetch if changed
 */
export const playlistETag = (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
        // Generate ETag from playlist data
        const etag = `"${Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 27)}"`;
        res.setHeader('ETag', etag);

        // Check if client has cached version
        const clientETag = req.get('If-None-Match');
        if (clientETag === etag) {
            return res.status(304).end();
        }

        // Cache for 60 seconds
        res.setHeader('Cache-Control', 'public, max-age=60');
        return originalJson(data);
    };

    next();
};
