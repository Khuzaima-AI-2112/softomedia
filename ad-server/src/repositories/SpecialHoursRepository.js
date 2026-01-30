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
        // CRITICAL FIX: Use set with merge: true (upsert) instead of update
        // update() fails if document doesn't exist, set() creates it
        if (this.collection) {
            await this.breaker.execute(() => this.collection.doc(id).set({
                ...hoursData,
                store_id: storeId,
                date: date,
                updated_at: new Date().toISOString()
            }, { merge: true }));

            // Update memory cache as well
            const existing = await this.findById(id) || {};
            const finalData = { ...existing, ...hoursData, store_id: storeId, date: date };
            MOCK_STORAGE[this.collectionName].set(id, finalData);
            return finalData;
        } else {
            // Fallback to memory
            return this.update(id, {
                ...hoursData,
                store_id: storeId,
                date: date
            });
        }
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
