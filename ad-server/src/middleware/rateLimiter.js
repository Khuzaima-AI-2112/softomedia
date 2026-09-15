/**
 * rateLimiter.js
 *
 * Sprint 9 — Task 9.3: Replace stub with a real in-memory sliding-window
 * rate limiter for device presentation reports (POST /api/device/proof-of-play
 * and /api/device/playback-observations).
 *
 * Design decisions:
 *   - In-process Map (no Redis dep for MVP) — resets on server restart.
 *   - Sliding window of 60 s, default limit 100 req/window per IP.
 *   - Export named `impressionLimiter` (primary) + legacy `rateLimiter` alias
 *     so any future import of the old name still resolves for 2 sprints.
 *   - Scoped only to POST /impression; all other telemetry routes are unaffected.
 *
 * Backward compatibility:
 *   - `export { impressionLimiter as rateLimiter }` ensures zero changes needed
 *     at any import site that still uses the old name.
 */

const WINDOW_MS  = 60 * 1000; // 1 minute
const MAX_HITS   = 100;

// Map<ip, { count: number, resetAt: number }>
const store = new Map();

// Prune stale entries every 5 minutes to prevent unbounded memory growth
const PRUNE_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.resetAt < now) store.delete(key);
    }
}, PRUNE_INTERVAL).unref(); // .unref() so the interval doesn't block process exit

/**
 * impressionLimiter(req, res, next)
 *
 * Allows up to MAX_HITS requests per WINDOW_MS per IP.
 * Returns 429 with Retry-After header when the limit is exceeded.
 */
export function impressionLimiter(req, res, next) {
    const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = store.get(ip);

    if (!entry || entry.resetAt < now) {
        // Start a new window
        entry = { count: 1, resetAt: now + WINDOW_MS };
        store.set(ip, entry);
        return next();
    }

    entry.count += 1;
    store.set(ip, entry);

    if (entry.count > MAX_HITS) {
        const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfterSec));
        return res.status(429).json({
            error:       'Too Many Requests',
            retryAfter:  retryAfterSec,
            limit:        MAX_HITS,
            windowMs:     WINDOW_MS
        });
    }

    return next();
}

// Backward-compat alias — remove after Sprint 11
export { impressionLimiter as rateLimiter };
