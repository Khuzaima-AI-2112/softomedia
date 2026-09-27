import { randomUUID } from 'node:crypto';
import { BaseRepository } from './BaseRepository.js';

export const OVERRIDE_DAYS = Object.freeze(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

/**
 * A Retailer's weekly schedule overrides for a Store (#16): a day of the week,
 * a start and end time, and whether that period is blocked or a forced playlist.
 */
export class ScheduleOverrideRepository extends BaseRepository {
    constructor() {
        super('schedule_overrides');
    }

    add(override) {
        return this.create(`sched_${randomUUID()}`, override);
    }

    /** A Store's overrides in week order, then by start time. */
    async findForStore(storeId) {
        const overrides = await this.findAll({ where: [['store_id', '==', storeId]] });
        return overrides.sort((a, b) =>
            OVERRIDE_DAYS.indexOf(a.day) - OVERRIDE_DAYS.indexOf(b.day) || a.start.localeCompare(b.start));
    }
}

export const scheduleOverrideRepository = new ScheduleOverrideRepository();
