/**
 * Explicit permission grants — Phase 1.
 * Every route authorizes a named action; no role inherits another's authority.
 *
 * Usage:
 *   router.get('/sensitive', authenticate, requirePermission(PERMISSIONS.X), handler);
 */

import { ROLES, normalizeRole } from '../constants/roles.js';

export { ROLES, normalizeRole };

export const PERMISSIONS = Object.freeze({
    PLATFORM_GOVERNANCE: 'platform.governance',
    PROOF_OF_PLAY_VIEW_NETWORK: 'proof_of_play.view_network',
    SUPPORT_TICKET_CREATE_OWN: 'support_ticket.create_own',
    SUPPORT_TICKET_VIEW_OWN: 'support_ticket.view_own',
    SUPPORT_TICKET_MANAGE_NETWORK: 'support_ticket.manage_network',
    SCREEN_MANAGEMENT: 'screens.manage',
    SCREEN_VIEW_OWN: 'screens.view_own',
    SCREEN_DIAGNOSTICS: 'screens.diagnostics',
    STORE_VIEW_NETWORK: 'stores.view_network',
    ORGANIZATION_MANAGEMENT: 'organizations.manage',
    ADVERTISER_VIEW_NETWORK: 'advertisers.view_network',
    CAMPAIGN_CREATE: 'campaigns.create',
    CAMPAIGN_DELETE: 'campaigns.delete',
    CAMPAIGN_APPROVAL: 'campaigns.approve',
    CAMPAIGN_VIEW_NETWORK: 'campaigns.view_network',
    LOOP_INJECT: 'loops.inject',
    LOOP_GENERATE: 'loops.generate',
    SCHEDULE_OVERRIDE: 'schedules.override',
    IMPRESSION_VIEW_NETWORK: 'impressions.view_network',
    IMPRESSION_VIEW_OWN: 'impressions.view_own',
    INVOICE_GENERATE: 'invoices.generate',
    INVOICE_VIEW_NETWORK: 'invoices.view_network',
    INVOICE_VIEW_OWN: 'invoices.view_own',
    AUDIT_VIEW_NETWORK: 'audit.view_network',
    AUDIT_VIEW_OWN: 'audit.view_own',
});

// The accepted Phase 1 permission matrix (docs/phase-1-demo-acceptance.md).
// Every grant is explicit; no role inherits another role's authority.
// Approval belongs to the Retailer Administrator alone; no administrative
// override approves on a Retailer's behalf.
const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.SUPERADMIN]: Object.freeze([
        PERMISSIONS.PLATFORM_GOVERNANCE,
        PERMISSIONS.PROOF_OF_PLAY_VIEW_NETWORK,
        PERMISSIONS.SUPPORT_TICKET_MANAGE_NETWORK,
        PERMISSIONS.SCREEN_MANAGEMENT,
        PERMISSIONS.SCREEN_DIAGNOSTICS,
        PERMISSIONS.STORE_VIEW_NETWORK,
        PERMISSIONS.ORGANIZATION_MANAGEMENT,
        PERMISSIONS.ADVERTISER_VIEW_NETWORK,
        PERMISSIONS.CAMPAIGN_CREATE,
        PERMISSIONS.CAMPAIGN_DELETE,
        PERMISSIONS.CAMPAIGN_VIEW_NETWORK,
        PERMISSIONS.LOOP_INJECT,
        PERMISSIONS.LOOP_GENERATE,
        PERMISSIONS.SCHEDULE_OVERRIDE,
        PERMISSIONS.IMPRESSION_VIEW_NETWORK,
        PERMISSIONS.INVOICE_GENERATE,
        PERMISSIONS.INVOICE_VIEW_NETWORK,
        PERMISSIONS.AUDIT_VIEW_NETWORK,
    ]),
    [ROLES.ADMIN]: Object.freeze([
        PERMISSIONS.SCREEN_MANAGEMENT,
        PERMISSIONS.STORE_VIEW_NETWORK,
        PERMISSIONS.ADVERTISER_VIEW_NETWORK,
        PERMISSIONS.CAMPAIGN_CREATE,
        PERMISSIONS.CAMPAIGN_VIEW_NETWORK,
        PERMISSIONS.LOOP_GENERATE,
        PERMISSIONS.SCHEDULE_OVERRIDE,
        PERMISSIONS.IMPRESSION_VIEW_NETWORK,
        PERMISSIONS.INVOICE_GENERATE,
        PERMISSIONS.INVOICE_VIEW_NETWORK,
    ]),
    [ROLES.BRAND]: Object.freeze([
        PERMISSIONS.CAMPAIGN_CREATE,
        PERMISSIONS.INVOICE_VIEW_OWN,
    ]),
    [ROLES.RETAILERADMIN]: Object.freeze([
        PERMISSIONS.SUPPORT_TICKET_CREATE_OWN,
        PERMISSIONS.SUPPORT_TICKET_VIEW_OWN,
        PERMISSIONS.SCREEN_VIEW_OWN,
        PERMISSIONS.CAMPAIGN_APPROVAL,
        PERMISSIONS.SCHEDULE_OVERRIDE,
        PERMISSIONS.IMPRESSION_VIEW_OWN,
        PERMISSIONS.AUDIT_VIEW_OWN,
    ]),
    [ROLES.TECHOPERATOR]: Object.freeze([
        PERMISSIONS.SUPPORT_TICKET_MANAGE_NETWORK,
        PERMISSIONS.SCREEN_MANAGEMENT,
        PERMISSIONS.SCREEN_DIAGNOSTICS,
        PERMISSIONS.STORE_VIEW_NETWORK,
        PERMISSIONS.AUDIT_VIEW_NETWORK,
    ]),
});

/** The explicit grants a user holds, for the profile the client gates its UI on. */
export function permissionsFor(user) {
    return [...new Set([
        ...(ROLE_PERMISSIONS[normalizeRole(user?.role)] ?? []),
        ...(Array.isArray(user?.permissions) ? user.permissions : []),
    ])];
}

export function userHasPermission(user, permission) {
    return permissionsFor(user).includes(permission);
}

/**
 * Require a named action grant instead of inferring authority from rank.
 * `requiredRole` preserves the established denial response for existing API consumers;
 * pass null for the generic denial that names no roles.
 */
export function requirePermission(permission, requiredRole = permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(500).json({ error: 'Misconfigured route: authentication middleware missing' });
        }

        const role = normalizeRole(req.user.role);
        if (!userHasPermission(req.user, permission)) {
            if (requiredRole === null) return res.status(403).json({ error: 'Access denied' });
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
export const requireNetworkProofOfPlayView = requirePermission(
    PERMISSIONS.PROOF_OF_PLAY_VIEW_NETWORK,
    ROLES.TECHOPERATOR,
);
export const requireScreenManagement = requirePermission(
    PERMISSIONS.SCREEN_MANAGEMENT,
    ROLES.TECHOPERATOR,
);
export const requireCampaignApproval = requirePermission(
    PERMISSIONS.CAMPAIGN_APPROVAL,
    null,
);
export const requireOrganizationManagement = requirePermission(
    PERMISSIONS.ORGANIZATION_MANAGEMENT,
    ROLES.SUPERADMIN,
);
export const requireScreenDiagnostics = requirePermission(
    PERMISSIONS.SCREEN_DIAGNOSTICS,
    ROLES.TECHOPERATOR,
);
