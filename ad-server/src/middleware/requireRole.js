/**
 * requireRole — Phase 1
 * Factory that returns an Express middleware enforcing a minimum role.
 *
 * Usage:
 *   router.get('/sensitive', requireRole('superadmin'), handler);
 *
 * The demo auth layer sets req.user.role from the x-demo-role header
 * (or from the JWT in production).  This middleware rejects anything
 * that doesn't match the expected role.
 */

import { ROLES, ROLE_HIERARCHY, normalizeRole } from '../constants/roles.js';

export { ROLES, ROLE_HIERARCHY, normalizeRole };

export const PERMISSIONS = Object.freeze({
    PLATFORM_GOVERNANCE: 'platform.governance',
});

const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.SUPERADMIN]: Object.freeze([PERMISSIONS.PLATFORM_GOVERNANCE]),
});

/**
 * requireRole(minRole)
 * Middleware that allows requests where req.user.role >= minRole
 * in the ROLE_HIERARCHY table.
 */
export function requireRole(minRole) {
    return (req, res, next) => {
        // Guard: req.user must be populated by authenticate() before this middleware runs.
        // If it is absent, the route is misconfigured — authenticate is missing from the chain.
        // Return 500 (not 403) so the misconfiguration is immediately distinguishable from
        // a legitimate access-denied response.
        if (!req.user) {
            console.error(
                `[requireRole] FATAL: req.user undefined on ${req.method} ${req.path} — authenticate middleware is missing.`
            );
            return res.status(500).json({ error: 'Misconfigured route: authentication middleware missing' });
        }

        const rawRole = req.user?.role;
        const role = normalizeRole(rawRole);
        const userLevel  = ROLE_HIERARCHY[role]  ?? -1;
        const minLevel   = ROLE_HIERARCHY[minRole] ?? 999;

        if (userLevel < minLevel) {
            return res.status(403).json({
                error: 'Forbidden',
                required: minRole,
                actual:   role || 'unauthenticated',
            });
        }
        // Stamp the normalized role so downstream handlers can trust it
        if (req.user) req.user.role = role;
        next();
    };
}

/** Convenience shorthand */
export const requireSuperAdmin = requireRole(ROLES.SUPERADMIN);

/**
 * Require a named action grant instead of inferring authority from rank.
 * `requiredRole` preserves the established denial response for existing API consumers.
 */
export function requirePermission(permission, requiredRole = permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(500).json({ error: 'Misconfigured route: authentication middleware missing' });
        }

        const role = normalizeRole(req.user.role);
        if (!ROLE_PERMISSIONS[role]?.includes(permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                required: requiredRole,
                actual: role || 'unauthenticated',
            });
        }
        req.user.role = role;
        next();
    };
}

export const requirePlatformGovernance = requirePermission(
    PERMISSIONS.PLATFORM_GOVERNANCE,
    ROLES.SUPERADMIN,
);
export const requireAdmin      = requireRole(ROLES.ADMIN);
