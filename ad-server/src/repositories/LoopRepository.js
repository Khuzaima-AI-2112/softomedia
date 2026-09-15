/**
 * Loop Repository
 * Manages hourly broadcast loops (12 ads × 5 seconds = 60 second loops)
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 */

import { BaseRepository } from './BaseRepository.js';
import { schedulingAuditRepository } from './SchedulingAuditRepository.js';

// Business hours configuration (Base range, can be overridden by store settings)
export const BUSINESS_HOURS = {
    START: 0,   // support all hours
    END: 24,
    get TOTAL_LOOPS() { return this.END - this.START; }
};

// Valid loop statuses — canonical stored values are lowercase.
// Uppercase property names are preserved as the import API for existing callers.
export const LOOP_STATUS = Object.freeze({
    get PENDING_APPROVAL() { return 'pending_approval'; },
    get REPLACEMENT_REQUESTED() { return 'replacement_requested'; },
    get APPROVED() { return 'approved'; },
    get REJECTED() { return 'rejected'; },
    get LIVE() { return 'live'; },
});

// Slot statuses — canonical stored values are lowercase.
// Uppercase property names are preserved as the import API for existing callers.
export const SLOT_STATUS = Object.freeze({
    get PENDING() { return 'pending'; },
    get APPROVED() { return 'approved'; },
    get REJECTED() { return 'rejected'; },
    get REPLACED() { return 'replaced'; },
    get BOOKED() { return 'booked'; },
    get AVAILABLE() { return 'available'; },
});

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
     * Override create to enforce business hours and store screen_ids
     */
    async create(id, data) {
        this.validateBusinessHour(data.hour);

        const loopData = {
            ...data,
            status: data.status || LOOP_STATUS.PENDING_APPROVAL,
            slots: data.slots || [],
            version: data.version || 1,
            screen_ids: data.screen_ids || (data.screen_id ? [data.screen_id] : []),
            generated_at: new Date().toISOString(),
            approved_at: null,
            approved_by: null
        };

        return super.create(id, loopData);
    }

    /**
     * Find loop by date and hour
     * @param {string} date - Format: YYYY-MM-DD
     * @param {number} hour - 0-23
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
     * Find approved loops for a screen on a specific date, sorted by version desc
     * so the latest approved version is always first.
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

        return all
            .filter(loop =>
                loop.date === date &&
                (loop.screen_id === screenId || loop.screen_id === 'ALL')
            )
            .sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
    }

    /**
     * Approve an entire loop.
     * Guards: loop must exist, must be PENDING_APPROVAL, all slots must have an asset.
     * @param {string} loopId
     * @param {string} userId
     * @returns {Promise<object>}
     */
    async approveLoop(loopId, userId) {
        const loop = await this.findById(loopId);
        if (!loop) throw new Error(`Loop ${loopId} not found`);

        if (loop.status !== LOOP_STATUS.PENDING_APPROVAL) {
            throw new Error(`Loop ${loopId} cannot be approved from status: ${loop.status}`);
        }

        const emptySlots = (loop.slots || []).filter(s => !s?.asset_id);
        if (emptySlots.length > 0) {
            throw new Error(`Loop ${loopId} has ${emptySlots.length} empty slot(s) and cannot be approved`);
        }

        const result = await this.update(loopId, {
            status: LOOP_STATUS.APPROVED,
            approved_at: new Date().toISOString(),
            approved_by: userId
        });

        await schedulingAuditRepository.logAction('loop_approved', {
            entity_id: loopId,
            user_id: userId,
            version: loop.version ?? 1,
            screen_count: loop.screen_ids?.length ?? 1,
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
    async rejectSlot(loopId, position, reason, userId = null) {
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
            rejected_at: new Date().toISOString(),
            rejected_by: userId,
        };

        const result = await this.update(loopId, {
            slots,
            status: LOOP_STATUS.REPLACEMENT_REQUESTED,
            approved_at: null,
            approved_by: null,
        });

        await schedulingAuditRepository.logAction('slot_rejected', {
            entity_id: loopId,
            slot_index: position,
            reason: reason,
            user_id: userId,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Replace a slot with a new asset.
     * If the loop is APPROVED, clones the loop into a new PENDING_APPROVAL draft
     * (version n+1) rather than mutating the approved document.
     * @param {string} loopId
     * @param {number} position - Slot position (0-11)
     * @param {string} newAssetId - Replacement asset ID
     * @param {string} userId - User performing the replacement (for audit log)
     * @returns {Promise<object>}
     */
    async replaceSlot(loopId, position, newAssetId, userId = null) {
        const loop = await this.findById(loopId);
        if (!loop) throw new Error(`Loop ${loopId} not found`);

        const slots = [...loop.slots];
        if (position < 0 || position >= slots.length) {
            throw new Error(`Invalid slot position: ${position}`);
        }

        // If loop is APPROVED, clone it into a new draft version instead of mutating
        if (loop.status === LOOP_STATUS.APPROVED) {
            const newVersion = (loop.version ?? 1) + 1;
            const newId = `${loopId}_v${newVersion}`;
            const clonedSlots = [...loop.slots];
            clonedSlots[position] = {
                ...clonedSlots[position],
                asset_id: newAssetId,
                status: SLOT_STATUS.REPLACED,
                replaced_at: new Date().toISOString()
            };

            const cloned = await this.create(newId, {
                ...loop,
                id: newId,
                status: LOOP_STATUS.PENDING_APPROVAL,
                version: newVersion,
                parentLoopId: loopId,
                slots: clonedSlots,
                approved_at: null,
                approved_by: null
            });

            await schedulingAuditRepository.logAction('slot_replaced', {
                entity_id: newId,
                parent_loop_id: loopId,
                slot_index: position,
                asset_id: newAssetId,
                user_id: userId,
                version: newVersion,
                timestamp: new Date().toISOString()
            });

            return cloned;
        }

        // Non-APPROVED loops: mutate in place
        slots[position] = {
            ...slots[position],
            asset_id: newAssetId,
            status: SLOT_STATUS.REPLACED,
            replaced_at: new Date().toISOString()
        };

        const returningToReview = loop.status === LOOP_STATUS.REPLACEMENT_REQUESTED
            || loop.status === LOOP_STATUS.REJECTED;
        const result = await this.update(loopId, {
            slots,
            ...(returningToReview ? {
                status: LOOP_STATUS.PENDING_APPROVAL,
                approved_at: null,
                approved_by: null,
            } : {}),
        });

        await schedulingAuditRepository.logAction('slot_replaced', {
            entity_id: loopId,
            slot_index: position,
            asset_id: newAssetId,
            user_id: userId,
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
