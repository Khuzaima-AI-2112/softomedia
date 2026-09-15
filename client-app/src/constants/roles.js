/** Canonical role string constants — mirrors ad-server/src/constants/roles.js */
export const ROLES = {
    SUPERADMIN:     'superadmin',
    ADMIN:          'admin',
    TECHOPERATOR:   'techoperator',
    RETAILERADMIN:  'retaileradmin',
    BRAND:          'brand',
};

export const CANONICAL_ROLES = Object.freeze([
    ROLES.SUPERADMIN,
    ROLES.ADMIN,
    ROLES.BRAND,
    ROLES.RETAILERADMIN,
    ROLES.TECHOPERATOR,
]);

export const DASHBOARD_ROUTE_BY_ROLE = Object.freeze({
    [ROLES.SUPERADMIN]: 'admin',
    [ROLES.ADMIN]: 'admin',
    [ROLES.BRAND]: 'brand',
    [ROLES.RETAILERADMIN]: 'retailer',
    [ROLES.TECHOPERATOR]: 'techoperator',
});

export function dashboardRouteForRole(role) {
    return DASHBOARD_ROUTE_BY_ROLE[normalizeRole(role)] || null;
}

/** Normalize super_admin / SUPER_ADMIN variants to canonical form */
export function normalizeRole(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    const cleaned = raw.replace(/[\s_-]/g, '').toLowerCase();
    if (cleaned === 'superadmin') return ROLES.SUPERADMIN;
    return raw;
}
