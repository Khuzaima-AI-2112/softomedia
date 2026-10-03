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
};

// Nobody approves an Hourly Loop (ADR 0007), so a loop has no approval status.
// A Slot an Admin corrected is marked replaced.
export const SLOT_STATUS = Object.freeze({
    get REPLACED() { return 'replaced'; },
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
            slots: data.slots || [],
            version: data.version || 1,
            screen_ids: data.screen_ids || (data.screen_id ? [data.screen_id] : []),
            generated_at: new Date().toISOString(),
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
     * Replace a slot with a new asset, in the loop that plays.
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

        // A replacement file is not part of the Creative, so the Slot leaves its Run (#75).
        const slot = { ...slots[position] };
        for (const field of ['run_start', 'run_length', 'run_file']) delete slot[field];
        slots[position] = {
            ...slot,
            asset_id: newAssetId,
            status: SLOT_STATUS.REPLACED,
            replaced_at: new Date().toISOString()
        };

        const result = await this.update(loopId, { slots });

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
