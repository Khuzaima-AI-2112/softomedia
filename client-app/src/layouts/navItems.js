import { ROLES } from '../constants/roles';

// ── Role-aware sidebar nav items ───────────────────────────────────────────────
// Every role but the Technical Operator reads the delivery report, scoped by the server (#41).
const DELIVERY_REPORT = { to: '/dashboard/delivery-report', icon: 'query_stats', label: 'Delivery by Daypart', testId: 'nav-delivery-report' };

// The Super Administrator approves a Creative for the network, then each Retailer for its Stores (ADR 0007).
const CREATIVE_APPROVALS = { to: '/dashboard/creative-approvals', icon: 'fact_check', label: 'Creative Approvals', testId: 'nav-creative-approvals' };

// superAdminOnly pages need platform.governance or organizations.manage, which the
// Admin role does not hold; listing them for Admin led to 403s and silent redirects.
const NETWORK_NAV = [
    { to: '/dashboard/admin', icon: 'dashboard', label: 'Overview', end: true, testId: 'nav-home' },
    { to: '/dashboard/admin/retailers', icon: 'storefront', label: 'Retailers' },
    { to: '/dashboard/admin/advertisers', icon: 'campaign', label: 'Advertisers' },
    { to: '/dashboard/admin/campaigns', icon: 'sell', label: 'Campaigns', testId: 'nav-campaigns' },
    { to: '/dashboard/admin/media', icon: 'perm_media', label: 'Media', testId: 'nav-media' },
    { to: '/dashboard/admin/screens', icon: 'tv', label: 'Screens' },
    { to: '/dashboard/admin/loops', icon: 'subscriptions', label: 'Loops' },
    { to: '/dashboard/admin/loop-analytics', icon: 'analytics', label: 'Loop Analytics', testId: 'nav-reports' },
    DELIVERY_REPORT,
    { to: '/dashboard/admin/users', icon: 'group', label: 'Users', superAdminOnly: true },
    { to: '/dashboard/admin/organizations', icon: 'domain', label: 'Organizations', superAdminOnly: true },
    { to: '/dashboard/admin/hours', icon: 'schedule', label: 'Business Hours' },
    { to: '/dashboard/admin/pricing', icon: 'payments', label: 'Pricing', superAdminOnly: true },
    { to: '/dashboard/admin/pricing-config', icon: 'tune', label: 'Pricing Config', superAdminOnly: true },
    { to: '/dashboard/admin/map', icon: 'map', label: 'Network Map' },
];

const ADMIN_NAV = NETWORK_NAV.filter(item => !item.superAdminOnly);

// Super Administrators manage every Support Ticket; Admin has no ticket access in Phase 1.
const SUPERADMIN_NAV = [
    ...NETWORK_NAV,
    CREATIVE_APPROVALS,
    { to: '/dashboard/tickets', icon: 'confirmation_number', label: 'Support Tickets', testId: 'nav-tickets' },
];

// fix(mvp-nav): add My Campaigns and Performance — MVP §3.4 "track campaign status"
// and "view basic campaign performance metrics" were built but unlinked.
const BRAND_NAV = [
    { to: '/dashboard/brand', icon: 'dashboard', label: 'Dashboard', end: true, testId: 'nav-home' },
    { to: '/dashboard/brand/campaign/new', icon: 'add_circle', label: 'New Campaign' },
    { to: '/dashboard/advertiser/campaigns', icon: 'sell', label: 'My Campaigns', testId: 'nav-campaigns' },
    { to: '/dashboard/advertiser', icon: 'insights', label: 'Performance', end: true, testId: 'nav-reports' },
    DELIVERY_REPORT,
    { to: '/dashboard/advertiser/invoices', icon: 'receipt_long', label: 'Invoices' },
];

// fix(#26b): add Loops — previously missing from retailer sidebar. A Retailer approves Creatives, not Campaigns (ADR 0007).
const RETAILER_NAV = [
    { to: '/dashboard/retailer', icon: 'dashboard', label: 'Dashboard', end: true, testId: 'nav-home' },
    { to: '/dashboard/retailer/schedule', icon: 'calendar_month', label: 'Schedule', testId: 'nav-calendar' },
    { to: '/dashboard/retailer/schedule-history', icon: 'history', label: 'Schedule History' },
    { to: '/dashboard/retailer/schedule-manager', icon: 'event_available', label: 'D-1 Preview' },
    { to: '/dashboard/retailer/hours', icon: 'schedule', label: 'Store Hours', testId: 'nav-store-hours' },
    { to: '/dashboard/retailer/loops', icon: 'subscriptions', label: 'Loops' },
    CREATIVE_APPROVALS,
    DELIVERY_REPORT,
    // fix(mvp-nav): MVP §3.2 — communicate feedback or issues to Softomedia
    { to: '/dashboard/tickets', icon: 'confirmation_number', label: 'Support Tickets', testId: 'nav-tickets' },
];

// Task 4.6 — TechOpsDashboard is now the landing page entry; Health remains accessible
const TECHOP_NAV = [
    { to: '/dashboard/techoperator', icon: 'monitor', label: 'Tech Ops', end: true, testId: 'nav-tech-ops' },
    { to: '/dashboard/techoperator/health', icon: 'monitor_heart', label: 'Health' },
    // fix(mvp-nav): MVP §3.5 — register/provision screens and assign them to retailers
    // and locations. ScreenManagement serves both; the Technical Operator holds the
    // screens.manage grant, so the screen renders with data for this persona.
    { to: '/dashboard/techoperator/screens', icon: 'tv', label: 'Screens', testId: 'nav-screens' },
    // fix(mvp-nav): MVP §3.5 — incident tracking and resolution
    { to: '/dashboard/tickets', icon: 'confirmation_number', label: 'Support Tickets', testId: 'nav-tickets' },
];

export function getNavItems(persona) {
    if (!persona) return [];
    if (persona === ROLES.SUPERADMIN) return SUPERADMIN_NAV;
    if (persona === ROLES.ADMIN) return ADMIN_NAV;
    if (persona === ROLES.BRAND) return BRAND_NAV;
    if (persona === ROLES.RETAILERADMIN) return RETAILER_NAV;
    if (persona === ROLES.TECHOPERATOR) return TECHOP_NAV;
    return [];
}
