// SpecialHoursRepository - Store date-specific hour overrides
// Extends BaseRepository for Firestore persistence

import { BaseRepository } from './BaseRepository.js';

class SpecialHoursRepositoryClass extends BaseRepository {
    constructor() {
        super('store_special_hours');
    }

    /**
     * Get special hours for a store on a specific date
     * @param {string} storeId 
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<Object|null>}
     */
    async getSpecialHours(storeId, date) {
        const results = await this.findAll({
            where: [
                ['store_id', '==', storeId],
                ['date', '==', date]
            ],
            limit: 1
        });
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Upsert special hours for a store
     * @param {string} storeId 
     * @param {string} date - YYYY-MM-DD
     * @param {Object} hoursData 
     */
    async updateSpecialHours(storeId, date, hoursData) {
        const id = hoursData.id || `spec_${storeId}_${date}`;
        // Use standard upsert logic (set with merge: true)
        return this.upsert(id, {
            ...hoursData,
            store_id: storeId,
            date: date
        });
    }

    /**
     * Get all special hours for a store
     * @param {string} storeId 
     */
    async getAllStoreSpecialHours(storeId) {
        return this.findAll({
            where: [['store_id', '==', storeId]]
        });
    }
}

export const SpecialHoursRepository = new SpecialHoursRepositoryClass();
export default SpecialHoursRepository;
