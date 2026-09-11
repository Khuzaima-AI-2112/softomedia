import { CANONICAL_ROLES } from '../constants/roles.js';

export const ACTIONS = Object.freeze({
    AUTHENTICATED_PROFILE_READ: 'authenticated-profile:read',
    ENTITY_RESOURCE_READ: 'entity-resource:read',
});

const ACTION_GRANTS = Object.freeze({
    [ACTIONS.AUTHENTICATED_PROFILE_READ]: new Set(CANONICAL_ROLES),
    [ACTIONS.ENTITY_RESOURCE_READ]: new Set(CANONICAL_ROLES),
});

const GLOBAL_ENTITY_ROLES = new Set(['superadmin', 'admin', 'techoperator']);

export function isAuthorized(identity, action, resourceScope = null) {
    if (!identity || !ACTION_GRANTS[action]?.has(identity.role)) return false;
    if (action === ACTIONS.AUTHENTICATED_PROFILE_READ) return true;

    const scopedEntityId = resourceScope?.linkedEntityId || resourceScope?.organizationId;
    if (!scopedEntityId) return false;
    if (GLOBAL_ENTITY_ROLES.has(identity.role)) return true;
    return (identity.linked_entity_id || identity.organization_id) === scopedEntityId;
}

export function requirePermission(action, resolveScope = () => null) {
    return (req, res, next) => {
        if (!isAuthorized(req.user, action, resolveScope(req))) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
}
