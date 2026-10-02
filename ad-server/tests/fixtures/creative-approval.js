/**
 * Seeded approvals of a Creative by each of these Retailers, for their Stores.
 * A Creative plays in a Store only with its Retailer's approval as well as the
 * Super Administrator's `approval_status` (ADR 0007).
 */
export function retailerApprovals(...retailerIds) {
    return Object.fromEntries(retailerIds.map(retailerId => [retailerId, { status: 'approved' }]));
}
