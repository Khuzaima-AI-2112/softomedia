/**
 * Explicit grants the signed-in profile carries (GET /api/auth/me).
 * Mirrors the names in ad-server/src/middleware/requireRole.js PERMISSIONS.
 */
export const PERMISSIONS = Object.freeze({
    ORGANIZATION_MANAGEMENT: 'organizations.manage',
    CAMPAIGN_CREATE: 'campaigns.create',
    CAMPAIGN_DELETE: 'campaigns.delete',
    CAMPAIGN_APPROVAL: 'campaigns.approve',
});
