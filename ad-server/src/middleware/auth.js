import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * DEMO_LINKED_ENTITY_OVERRIDES
 *
 * Maps demo role names to the seed advertiser/entity IDs that exist in
 * Firestore. Keeps the demo server in sync with AuthContext.setPersona()
 * on the client, which uses `entity-${type}` as a fallback.
 *
 * Add entries here when new seed advertisers are added to the database.
 */
const DEMO_LINKED_ENTITY_OVERRIDES = {
    advertiser: 'adv_001',
    brand:      'adv_002',
};

/**
 * Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Development/Test Bypass for QA Audit
    const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
    if (isDemoAllowed && authHeader === 'Bearer demo-token') {
        const demoRole = req.headers['x-demo-role'] || 'admin';

        // linked_entity_id: use known seed ID override if available, otherwise
        // fall back to `entity-${role}` — mirrors AuthContext.setPersona() so
        // the T5 JWT-stamping in campaigns.js resolves to a real advertiser ID
        // for brand/advertiser roles in demo mode.
        const linkedEntityId =
            DEMO_LINKED_ENTITY_OVERRIDES[demoRole] ??
            `entity-${demoRole}`;

        req.user = {
            role:             demoRole,
            email:            `demo-${demoRole}@example.com`,
            id:               `demo-${demoRole}`,
            linked_entity_id: linkedEntityId,
        };
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        logger.warn('Invalid token attempt', { error: error.message });
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Authorization Middleware (RBAC)
 * @param {Array} allowedRoles
 */
export const authorize = (allowedRoles) => {
    return (req, res, next) => {
        // Development/Test Bypass for QA Audit
        const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
        if (isDemoAllowed && req.user && req.user.email && req.user.email.startsWith('demo-')) {
            return next();
        }

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            logger.warn('Unauthorized access attempt', {
                user: req.user?.email,
                role: req.user?.role,
                path: req.path
            });
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }
        next();
    };
};
