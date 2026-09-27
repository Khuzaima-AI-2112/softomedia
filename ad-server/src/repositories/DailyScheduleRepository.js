import { BaseRepository } from './BaseRepository.js';

export class DailyScheduleRepository extends BaseRepository {
    constructor() {
        super('daily_schedules');
    }

    idFor(storeId, date) {
        return `${storeId}_${date}`;
    }

    findByStoreAndDate(storeId, date) {
        return this.findById(this.idFor(storeId, date));
    }

    async save(storeId, date, data) {
        const id = this.idFor(storeId, date);
        const document = {
            ...data,
            store_id: storeId,
            date,
        };
        const existing = await this.findById(id);
        return existing
            ? this.update(id, document)
            : this.create(id, document);
    }
}

export const dailyScheduleRepository = new DailyScheduleRepository();
