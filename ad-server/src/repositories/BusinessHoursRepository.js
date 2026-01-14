// BusinessHoursRepository - Store default weekly schedules
// Extends BaseRepository for Firestore persistence

import { BaseRepository } from './BaseRepository.js';

class BusinessHoursRepositoryClass extends BaseRepository {
    constructor() {
        super('store_default_hours');
    }

    /**
     * Get default weekly hours for a store
     * @param {string} storeId 
     * @returns {Promise<Array>} 
     */
    async getDefaultHours(storeId) {
        return this.findAll({
            where: [['store_id', '==', storeId]]
        });
    }

    /**
     * Update or set default hours for a store
     * @param {string} storeId 
     * @param {Array} weeklyHours 
     */
    async updateDefaultHours(storeId, weeklyHours) {
        // Find existing to replace or update
        const existing = await this.getDefaultHours(storeId);

        // This implementation keeps it simple - for a real production environment
        // we might want a transaction to delete and recreate.
        // For now, we will update individual days.
        const promises = weeklyHours.map(async hourSet => {
            const id = hourSet.id || `def_${storeId}_${hourSet.day_of_week}`;
            const existing = await this.findById(id);
            if (existing) {
                return this.update(id, {
                    ...hourSet,
                    store_id: storeId
                });
            } else {
                return this.create(id, {
                    ...hourSet,
                    store_id: storeId
                });
            }
        });

        return Promise.all(promises);
    }
}

export const BusinessHoursRepository = new BusinessHoursRepositoryClass();
export default BusinessHoursRepository;
