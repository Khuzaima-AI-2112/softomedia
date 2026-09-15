/** Canonical role string constants — mirrors client-app/src/constants/roles.js */
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

// Retired roles such as contentmanager and advertiser are not canonical and resolve to null.
export function toCanonicalRole(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.replace(/[\s_-]/g, '').toLowerCase();
    if (cleaned === 'superadmin') return ROLES.SUPERADMIN;
    return CANONICAL_ROLES.includes(cleaned) ? cleaned : null;
}

/** Normalize super_admin / SUPER_ADMIN variants to canonical form */
export function normalizeRole(raw) {
    return toCanonicalRole(raw) || raw;
}
