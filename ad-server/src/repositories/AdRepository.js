// Ad Repository
// Handles all ad-related database operations

import { BaseRepository } from './BaseRepository.js';

export class AdRepository extends BaseRepository {
    constructor() {
        super('ads');
    }

    /**
     * Find ads by status
     * @param {string} status - Ad status (approved, pending, rejected)
     * @returns {Promise<Array>} Array of ads
     */
    async findByStatus(status) {
        return this.findAll({
            where: [['status', '==', status]]
        });
    }

    /**
     * Find approved ads (for playlist generation)
     * @returns {Promise<Array>} Array of approved ads
     */
    async findApproved() {
        return this.findByStatus('approved');
    }

    /**
     * Find ads by brand/campaign
     * @param {string} brandId - Brand ID
     * @returns {Promise<Array>} Array of ads
     */
    async findByBrand(brandId) {
        return this.findAll({
            where: [['brand_id', '==', brandId]]
        });
    }
}
