
import rateLimit from 'express-rate-limit';

/**
 * AI Guardrails Middleware
 * 1. IP Whitelist Inspection (Fail-Fast)
 * 2. Execution Timeout (Fail-Safe)
 * 3. Rate Limiting (Abuse Prevention)
 */

// Basic Rate Limiter for AI endpoints
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per window
    message: { error: 'Too many AI requests, please try again later.' }
});

export const guardrails = (req, res, next) => {
    // 1. IP Whitelist Check
    const allowedIp = process.env.DEV_ALLOWED_IP;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Localhost always allowed for dev
    const isLocal = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('127.0.0.1');

    // Check if IP matches allowed IP
    // Note: in production behind proxy, trust proxy might need configuration, 
    // but for now we check the direct req.ip or x-forwarded-for if we parsed it.
    // robust check: 
    const isAllowed = isLocal || (allowedIp && clientIp.includes(allowedIp));

    if (!isAllowed) {
        console.warn(`[Ghost-AI] Blocked access from unauthorized IP: ${clientIp}`);
        return res.status(403).json({ error: 'Ghost AI is not reachable from this location.' });
    }

    // 2. Timeout Wrapper
    // We wrap the *next* execution in a promise/timeout logic handled by the router usually, 
    // but here we can set a socket timeout.
    res.setTimeout(25000, () => {
        console.error('[Ghost-AI] Request timed out');
        if (!res.headersSent) {
            res.status(504).json({ error: 'AI took too long to respond' });
        }
    });

    // Pass to rate limiter then next
    aiLimiter(req, res, next);
};
