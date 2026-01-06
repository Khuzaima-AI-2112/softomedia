/**
 * Loop Repository
 * Manages hourly broadcast loops (12 ads × 5 seconds = 60 second loops)
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 */

import { BaseRepository } from './BaseRepository.js';
import { schedulingAuditRepository } from './SchedulingAuditRepository.js';

// Business hours configuration
export const BUSINESS_HOURS = {
    START: 8,   // 8:00 AM
    END: 22,    // 10:00 PM (22:00)
    get TOTAL_LOOPS() { return this.END - this.START; } // 14 loops
};

// Valid loop statuses
export const LOOP_STATUS = {
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    LIVE: 'LIVE'
};

// Slot statuses
export const SLOT_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    REPLACED: 'REPLACED',
    BOOKED: 'BOOKED',
    AVAILABLE: 'AVAILABLE'
};

export class LoopRepository extends BaseRepository {
    constructor() {
        super('loops');
    }

    /**
     * Validate hour is within business hours
     */
    validateBusinessHour(hour) {
        if (hour < BUSINESS_HOURS.START || hour >= BUSINESS_HOURS.END) {
            throw new Error(`Hour ${hour} is outside business hours (${BUSINESS_HOURS.START}:00 - ${BUSINESS_HOURS.END}:00)`);
        }
    }

    /**
     * Override create to enforce business hours
     */
    async create(id, data) {
        this.validateBusinessHour(data.hour);

        // Ensure loop has required fields
        const loopData = {
            ...data,
            status: data.status || LOOP_STATUS.PENDING_APPROVAL,
            slots: data.slots || [],
            generated_at: new Date().toISOString(),
            approved_at: null,
            approved_by: null
        };

        return super.create(id, loopData);
    }

    /**
     * Find loop by date and hour
     * @param {string} date - Format: YYYY-MM-DD
     * @param {number} hour - 8-21
     * @returns {Promise<object|null>}
     */
    async findByDateAndHour(date, hour) {
        const id = `${date}_${hour}`;
        return this.findById(id);
    }

    /**
     * Find all pending loops for a retailer
     * @param {string} retailerId
     * @returns {Promise<Array>}
     */
    async findPendingByRetailer(retailerId) {
        const all = await this.findAll({
            where: [
                ['retailer_id', '==', retailerId],
                ['status', '==', LOOP_STATUS.PENDING_APPROVAL]
            ]
        });
        return all;
    }

    /**
     * Find approved loops for a screen on a specific date
     * @param {string} screenId
     * @param {string} date - Format: YYYY-MM-DD
     * @returns {Promise<Array>}
     */
    async findApprovedByScreen(screenId, date) {
        const all = await this.findAll({
            where: [
                ['status', '==', LOOP_STATUS.APPROVED]
            ]
        });

        // Filter by date and screen assignment
        return all.filter(loop =>
            loop.date === date &&
            (loop.screen_id === screenId || loop.screen_id === 'ALL')
        );
    }

    /**
     * Approve an entire loop
     * @param {string} loopId
     * @param {string} userId
     * @returns {Promise<object>}
     */
    async approveLoop(loopId, userId) {
        const result = await this.update(loopId, {
            status: LOOP_STATUS.APPROVED,
            approved_at: new Date().toISOString(),
            approved_by: userId
        });

        await schedulingAuditRepository.logAction('loop_approved', {
            entity_id: loopId,
            user_id: userId,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Reject a specific slot in a loop
     * @param {string} loopId
     * @param {number} position - Slot position (0-11)
     * @param {string} reason - Rejection reason
     * @returns {Promise<object>}
     */
    async rejectSlot(loopId, position, reason) {
        const loop = await this.findById(loopId);
        if (!loop) throw new Error(`Loop ${loopId} not found`);

        const slots = [...loop.slots];
        if (position < 0 || position >= slots.length) {
            throw new Error(`Invalid slot position: ${position}`);
        }

        slots[position] = {
            ...slots[position],
            status: SLOT_STATUS.REJECTED,
            rejection_reason: reason,
            rejected_at: new Date().toISOString()
        };

        const result = await this.update(loopId, { slots });

        await schedulingAuditRepository.logAction('slot_rejected', {
            entity_id: loopId,
            slot_index: position,
            reason: reason,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Replace a rejected slot with a new asset
     * @param {string} loopId
     * @param {number} position - Slot position (0-11)
     * @param {string} newAssetId - Replacement asset ID
     * @returns {Promise<object>}
     */
    async replaceSlot(loopId, position, newAssetId) {
        const loop = await this.findById(loopId);
        if (!loop) throw new Error(`Loop ${loopId} not found`);

        const slots = [...loop.slots];
        if (position < 0 || position >= slots.length) {
            throw new Error(`Invalid slot position: ${position}`);
        }

        slots[position] = {
            ...slots[position],
            asset_id: newAssetId,
            status: SLOT_STATUS.REPLACED,
            replaced_at: new Date().toISOString()
        };

        return this.update(loopId, { slots });
    }

    /**
     * Book a slot in a loop for an advertiser campaign
     * @param {string} loopId
     * @param {number} position - Slot position (0-11)
     * @param {object} bookingData - { campaign_id, advertiser_id, creative_url, booked_at }
     * @returns {Promise<object>}
     */
    async bookSlot(loopId, position, bookingData) {
        const loop = await this.findById(loopId);
        if (!loop) throw new Error(`Loop ${loopId} not found`);

        const slots = loop.slots ? [...loop.slots] : Array(12).fill(null).map((_, i) => ({
            position: i,
            status: SLOT_STATUS.AVAILABLE,
            asset_id: null
        }));

        if (position < 0 || position >= slots.length) {
            throw new Error(`Invalid slot position: ${position}`);
        }

        slots[position] = {
            ...slots[position],
            position,
            status: SLOT_STATUS.BOOKED,
            campaign_id: bookingData.campaign_id,
            advertiser_id: bookingData.advertiser_id,
            creative_url: bookingData.creative_url,
            booked_at: bookingData.booked_at || new Date().toISOString()
        };

        const result = await this.update(loopId, { slots });

        await schedulingAuditRepository.logAction('slot_booked', {
            entity_id: loopId,
            slot_index: position,
            campaign_id: bookingData.campaign_id,
            advertiser_id: bookingData.advertiser_id,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Get all loops for a specific date
     * @param {string} date - Format: YYYY-MM-DD
     * @returns {Promise<Array>}
     */
    async findByDate(date) {
        const all = await this.findAll({
            where: [['date', '==', date]]
        });
        return all.sort((a, b) => a.hour - b.hour);
    }
}

export const loopRepository = new LoopRepository();
