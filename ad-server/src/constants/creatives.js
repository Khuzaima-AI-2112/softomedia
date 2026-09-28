/** A Creative's approval status. Only an approved Creative plays. */
export const CREATIVE_STATUS = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVOKED: 'revoked',
});

/** A Creative holds one, two or three five-second files, played in consecutive Slots. */
export const MAXIMUM_CREATIVE_FILES = 3;
