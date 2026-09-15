import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { ROLES, toCanonicalRole } from '../constants/roles.js';
import { authService } from '../services/AuthService.js';
import { getFirebaseAuth } from '../utils/firebaseAuth.js';
import { PERMISSIONS } from './requireRole.js';

const JWT_SECRET = process.env.JWT_SECRET;

const DEMO_LINKED_ENTITY_OVERRIDES = {
    [ROLES.BRAND]:         'demo-advertiser-bonvie',
    advertiser:            'demo-advertiser-bonvie',
    retailer:              'demo-retailer-freshmart',
    [ROLES.RETAILERADMIN]: 'demo-retailer-freshmart',
};

function authenticationFailure(res) {
    return res.status(401).json({ error: 'Authentication required' });
}

function legacyDemoIdentity(req) {
    const requestedRole = req.headers['x-demo-role'] || ROLES.ADMIN;
    const role = toCanonicalRole(requestedRole);
    if (!role) return null;
    const organizationId = req.headers['x-demo-retailer-id']
        || DEMO_LINKED_ENTITY_OVERRIDES[requestedRole]
        || `entity-${role}`;
    return {
        role,
        email: `demo-${role}@example.com`,
        id: `demo-${role}`,
        linked_entity_id: organizationId,
        organization_id: organizationId,
        permissions: role === ROLES.TECHOPERATOR ? [
            PERMISSIONS.PROOF_OF_PLAY_VIEW_NETWORK,
        ] : [],
    };
}

/**
 * Verifies a Firebase ID token and loads the corresponding Softomedia identity.
 * A legacy demo identity is available only to the non-production compatibility
 * suite and can never be enabled in a deployed production revision.
 */
export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const legacyDemoAllowed = process.env.NODE_ENV === 'test'
        || (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_MODE === 'true');

    if (legacyDemoAllowed && authHeader === 'Bearer demo-token') {
        req.user = legacyDemoIdentity(req);
        if (!req.user) return authenticationFailure(res);
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return authenticationFailure(res);
    }

    const token = authHeader.slice('Bearer '.length);
    try {
        const decoded = await getFirebaseAuth().verifyIdToken(token);
        req.user = await authService.resolveFirebaseIdentity(decoded);
        if (!req.user) return authenticationFailure(res);
        return next();
    } catch (error) {
        if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_LEGACY_JWT_AUTH === 'true') {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const role = toCanonicalRole(decoded.role);
                if (!role) return authenticationFailure(res);
                req.user = { ...decoded, role };
                return next();
            } catch {
                // Return the same public failure as every other auth error.
            }
        }
        logger.warn('Authentication failed', { reason: error.code || error.name });
        return authenticationFailure(res);
    }
};
