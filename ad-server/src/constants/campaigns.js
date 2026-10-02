/**
 * A Campaign's status. Nobody approves a Campaign (ADR 0007): it is scheduled
 * once submitted, and a Brand's Slot plays once its Creative has both approvals.
 */
export const CAMPAIGN_STATUS = Object.freeze({
    SCHEDULED: 'scheduled',
    CANCELLED: 'cancelled',
});

/** Statuses a Campaign never leaves; earlier data may still carry the older ones. */
const ENDED_STATUSES = new Set([CAMPAIGN_STATUS.CANCELLED, 'rejected', 'completed']);

/** Whether a Campaign has finished, so it can no longer be cancelled. */
export function hasCampaignEnded(campaign) {
    return ENDED_STATUSES.has(campaign.status);
}

/** Whether a Campaign may play: it exists, has not ended, and is not paused or deleted. */
export function isCampaignRunning(campaign) {
    return Boolean(campaign)
        && !campaign.deleted_at
        && campaign.status !== 'paused'
        && !hasCampaignEnded(campaign);
}
