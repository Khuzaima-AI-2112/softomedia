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

export const CANONICAL_ROLES = Object.freeze([
    ROLES.SUPERADMIN,
    ROLES.ADMIN,
    ROLES.BRAND,
    ROLES.RETAILERADMIN,
    ROLES.TECHOPERATOR,
]);

export const LEGACY_ROLE_MIGRATIONS = Object.freeze({
    contentmanager: ROLES.ADMIN,
    advertiser: ROLES.BRAND,
});

export function toCanonicalRole(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.replace(/[\s_-]/g, '').toLowerCase();
    if (cleaned === 'superadmin') return ROLES.SUPERADMIN;
    const migrated = LEGACY_ROLE_MIGRATIONS[cleaned];
    if (migrated) return migrated;
    return CANONICAL_ROLES.includes(cleaned) ? cleaned : null;
}

/** Normalize super_admin / SUPER_ADMIN variants to canonical form */
export function normalizeRole(raw) {
    return toCanonicalRole(raw) || raw;
}
