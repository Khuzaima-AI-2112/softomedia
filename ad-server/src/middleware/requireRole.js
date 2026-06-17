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

export const ROLE_HIERARCHY = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    brand:          1,   // fix: brand was missing — level 1 (same tier as retaileradmin)
    advertiser:     0,
};

/**
 * Normalize legacy / inconsistent SUPER_ADMIN variants to the
 * canonical 'superadmin' string used everywhere in Phase 1.
 *
 * Handles: 'super_admin', 'SUPER_ADMIN', 'SuperAdmin', 'Super Admin'
 */
export function normalizeRole(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    const cleaned = raw.replace(/[\s_-]/g, '').toLowerCase();
    if (cleaned === 'superadmin') return 'superadmin';
    return raw; // pass other roles through unchanged
}

/**
 * requireRole(minRole)
 * Middleware that allows requests where req.user.role >= minRole
 * in the ROLE_HIERARCHY table.
 */
export function requireRole(minRole) {
    return (req, res, next) => {
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
export const requireSuperAdmin = requireRole('superadmin');
export const requireAdmin      = requireRole('admin');
