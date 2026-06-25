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
export const requireAdmin      = requireRole(ROLES.ADMIN);
