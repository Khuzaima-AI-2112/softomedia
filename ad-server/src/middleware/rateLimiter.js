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
const PRUNE_INTERVAL = 5 * 60 * 1000;

/**
 * createRateLimiter({ maxHits, windowMs })
 *
 * Allows up to maxHits requests per windowMs per IP. Each limiter keeps its
 * own counts, so one route's traffic never spends another route's budget.
 * Returns 429 with Retry-After header when the limit is exceeded.
 */
export function createRateLimiter({ maxHits = MAX_HITS, windowMs = WINDOW_MS } = {}) {
    // Map<ip, { count: number, resetAt: number }>
    const store = new Map();

    // Prune stale entries to prevent unbounded memory growth
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            if (entry.resetAt < now) store.delete(key);
        }
    }, PRUNE_INTERVAL).unref(); // .unref() so the interval doesn't block process exit

    return function rateLimit(req, res, next) {
        const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();

        let entry = store.get(ip);

        if (!entry || entry.resetAt < now) {
            // Start a new window
            entry = { count: 1, resetAt: now + windowMs };
            store.set(ip, entry);
            return next();
        }

        entry.count += 1;
        store.set(ip, entry);

        if (entry.count > maxHits) {
            const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
            res.set('Retry-After', String(retryAfterSec));
            return res.status(429).json({
                error:       'Too Many Requests',
                retryAfter:  retryAfterSec,
                limit:        maxHits,
                windowMs
            });
        }

        return next();
    };
}

/** Device presentation reports: MAX_HITS per WINDOW_MS per IP. */
export const impressionLimiter = createRateLimiter();

// Backward-compat alias — remove after Sprint 11
export { impressionLimiter as rateLimiter };
