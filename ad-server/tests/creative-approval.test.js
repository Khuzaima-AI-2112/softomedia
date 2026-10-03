import { describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { isCreativeApprovedFor } = await import('../src/services/CreativeApproval.js');

const TORONTO = 'America/Toronto';
const REVOKED_AT = '2030-01-07T13:20:00.000Z'; // 08:20 in Toronto
const approved = { status: 'approved', decided_at: '2030-01-01T12:00:00.000Z' };
const revoked = { status: 'revoked', decided_at: REVOKED_AT };

const creative = ({ network = approved, retailer = approved } = {}) => ({
    approval_status: network.status,
    decided_at: network.decided_at,
    retailer_approvals: retailer ? { harbor: retailer } : {},
});

const at = iso => ({ now: new Date(iso), timeZone: TORONTO });

describe('isCreativeApprovedFor', () => {
    test('needs the Super Administrator\'s approval and this Retailer\'s', () => {
        expect(isCreativeApprovedFor(creative(), 'harbor')).toBe(true);
        expect(isCreativeApprovedFor(creative(), 'northwind')).toBe(false);
        expect(isCreativeApprovedFor(creative({ retailer: null }), 'harbor')).toBe(false);
        expect(isCreativeApprovedFor(creative({ network: { status: 'pending' } }), 'harbor')).toBe(false);
        expect(isCreativeApprovedFor(null, 'harbor')).toBe(false);
    });

    // ADR 0007, #38: the hour it is revoked in plays on unchanged, Store time.
    test.each([
        ['the Super Administrator', { network: revoked }],
        ['the Retailer', { retailer: revoked }],
    ])('a Creative revoked by %s still plays out the Store hour it was revoked in', (_, decisions) => {
        const revokedCreative = creative(decisions);

        expect(isCreativeApprovedFor(revokedCreative, 'harbor', at('2030-01-07T13:59:59.999Z'))).toBe(true);
        expect(isCreativeApprovedFor(revokedCreative, 'harbor', at('2030-01-07T14:00:00.000Z'))).toBe(false);
        expect(isCreativeApprovedFor(revokedCreative, 'harbor', at('2030-01-08T13:30:00.000Z'))).toBe(false);
        // Without a moment to play at, a revoked Creative is not approved.
        expect(isCreativeApprovedFor(revokedCreative, 'harbor')).toBe(false);
    });
});
