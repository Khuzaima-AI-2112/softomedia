/** Canonical role string constants — mirrors client-app/src/constants/roles.js */
export const ROLES = {
    SUPERADMIN:     'superadmin',
    ADMIN:          'admin',
    CONTENTMANAGER: 'contentmanager',
    TECHOPERATOR:   'techoperator',
    RETAILERADMIN:  'retaileradmin',
    BRAND:          'brand',
    ADVERTISER:     'advertiser',
};

/** Role hierarchy levels — single source, mirrors requireRole.js */
export const ROLE_HIERARCHY = {
    [ROLES.SUPERADMIN]:     5,
    [ROLES.ADMIN]:          4,
    [ROLES.CONTENTMANAGER]: 3,
    [ROLES.TECHOPERATOR]:   2,
    [ROLES.RETAILERADMIN]:  1,
    [ROLES.BRAND]:          1,
    [ROLES.ADVERTISER]:     0,
};

/** Normalize super_admin / SUPER_ADMIN variants to canonical form */
export function normalizeRole(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    const cleaned = raw.replace(/[\s_-]/g, '').toLowerCase();
    if (cleaned === 'superadmin') return ROLES.SUPERADMIN;
    return raw;
}
