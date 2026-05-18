import { BaseRepository } from './BaseRepository.js';

export class RetailerRepository extends BaseRepository {
    constructor() {
        super('retailers');
    }

    /**
     * Soft-delete a retailer by setting status to 'inactive'
     * Preserves referential integrity with stores, screens, loops, impressions
     * @param {string} id
     * @returns {Promise<object>} Updated snapshot
     */
    async softDelete(id) {
        const docRef = this.db.collection('retailers').doc(id);
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error(`Retailer document ${id} not found`);
        }
        await docRef.update({
            status: 'inactive',
            updatedat: new Date().toISOString()
        });
        const updated = await docRef.get();
        return { id: updated.id, ...updated.data() };
    }

    /**
     * Update the status of a retailer
     * @param {string} id
     * @param {string} status - 'active' or 'inactive'
     * @returns {Promise<object>} Updated snapshot
     */
    async updateStatus(id, status) {
        const docRef = this.db.collection('retailers').doc(id);
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error(`Retailer document ${id} not found`);
        }
        await docRef.update({
            status,
            updatedat: new Date().toISOString()
        });
        const updated = await docRef.get();
        return { id: updated.id, ...updated.data() };
    }
}

export const retailerRepository = new RetailerRepository();
