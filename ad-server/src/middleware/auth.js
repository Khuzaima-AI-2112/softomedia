import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { ROLES } from '../constants/roles.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * DEMO_LINKED_ENTITY_OVERRIDES
 *
 * Maps demo role names to the seed entity IDs written by
 * tests/demo_wizard/00_seed.setup.js (single source of truth).
 *
 * IMPORTANT: these values must stay in sync with the DEMO_* constants
 * exported from 00_seed.setup.js. When seed IDs change, update both files.
 *
 *   DEMO_ADVERTISER_ID = 'demo-advertiser-bonvie'
 *   DEMO_RETAILER_ID   = 'demo-retailer-freshmart'
 *
 * Previously used adv_001 / adv_002 — those are legacy SeedService IDs
 * that no longer exist in the Firestore seed written by 00_seed.setup.js,
 * causing T5 advertiser_id stamping to resolve to a non-existent entity.
 */
const DEMO_LINKED_ENTITY_OVERRIDES = {
    [ROLES.BRAND]:         'demo-advertiser-bonvie',   // DEMO_ADVERTISER_ID
    [ROLES.ADVERTISER]:    'demo-advertiser-bonvie',   // DEMO_ADVERTISER_ID
    retailer:              'demo-retailer-freshmart',  // DEMO_RETAILER_ID
    [ROLES.RETAILERADMIN]: 'demo-retailer-freshmart',  // DEMO_RETAILER_ID (alias)
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
