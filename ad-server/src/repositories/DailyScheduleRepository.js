import { BaseRepository } from './BaseRepository.js';

export class DailyScheduleRepository extends BaseRepository {
    constructor() {
        super('daily_schedules');
    }

    idFor(locationId, date) {
        return `${locationId}_${date}`;
    }

    findByLocationAndDate(locationId, date) {
        return this.findById(this.idFor(locationId, date));
    }

    async findLatestBefore(locationId, date) {
        const schedules = await this.findAll({
            where: [['location_id', '==', locationId]],
        });
        return schedules
            .filter(schedule => schedule.date < date)
            .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    }

    async save(locationId, date, data) {
        const id = this.idFor(locationId, date);
        const document = {
            ...data,
            location_id: locationId,
            date,
        };
        const existing = await this.findById(id);
        return existing
            ? this.update(id, document)
            : this.create(id, document);
    }
}

export const dailyScheduleRepository = new DailyScheduleRepository();
