/**
 * Explicit grants the signed-in profile carries (GET /api/auth/me).
 * Mirrors the names in ad-server/src/middleware/requireRole.js PERMISSIONS.
 */
export const PERMISSIONS = Object.freeze({
    ORGANIZATION_MANAGEMENT: 'organizations.manage',
    CAMPAIGN_CREATE: 'campaigns.create',
    CAMPAIGN_DELETE: 'campaigns.delete',
    CAMPAIGN_APPROVAL: 'campaigns.approve',
    CAMPAIGN_VIEW_NETWORK: 'campaigns.view_network',
    INVOICE_VIEW_NETWORK: 'invoices.view_network',
    INVOICE_VIEW_OWN: 'invoices.view_own',
    SUPPORT_TICKET_CREATE_OWN: 'support_ticket.create_own',
    SUPPORT_TICKET_MANAGE_NETWORK: 'support_ticket.manage_network',
});
