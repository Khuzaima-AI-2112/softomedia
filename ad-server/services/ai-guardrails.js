
import rateLimit from 'express-rate-limit';

/**
 * AI Guardrails Middleware
 * 1. IP Whitelist Inspection (Fail-Fast)
 * 2. Execution Timeout (Fail-Safe)
 * 3. Rate Limiting (Abuse Prevention)
 */

// Daily Rate Limiter for AI endpoints (100 calls per day per IP/Browser)
const aiLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Daily AI limit reached (100 requests/day). Please try again tomorrow.' }
});

export const guardrails = (req, res, next) => {
    // 1. Timeout Wrapper
    // We wrap the *next* execution in a promise/timeout logic handled by the router usually, 
    // but here we can set a socket timeout.
    res.setTimeout(25000, () => {
        console.error('[Ghost-AI] Request timed out');
        if (!res.headersSent) {
            res.status(504).json({ error: 'AI took too long to respond' });
        }
    });

    // 2. Daily Rate Limiting
    aiLimiter(req, res, next);
};
