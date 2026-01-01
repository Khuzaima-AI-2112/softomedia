// Impression Repository
// Handles all impression tracking operations

import { BaseRepository } from './BaseRepository.js';

export class ImpressionRepository extends BaseRepository {
    constructor() {
        super('impressions');
    }

    /**
     * Record a new impression
     * @param {string} screenId - Screen ID
     * @param {string} adId - Ad ID
     * @returns {Promise<object>} Created impression document
     */
    async record(screenId, adId) {
        const impressionId = `${screenId}_${adId}_${Date.now()}`;
        return this.create(impressionId, {
            screen_id: screenId,
            ad_id: adId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get impressions for a specific screen
     * @param {string} screenId - Screen ID
     * @param {object} options - Query options (limit, date range)
     * @returns {Promise<Array>} Array of impressions
     */
    async findByScreen(screenId, options = {}) {
        const queryOptions = {
            where: [['screen_id', '==', screenId]],
            orderBy: ['timestamp', 'desc']
        };

        if (options.limit) {
            queryOptions.limit = options.limit;
        }

        return this.findAll(queryOptions);
    }

    /**
     * Get impressions for a specific ad
     * @param {string} adId - Ad ID
     * @param {object} options - Query options (limit, date range)
     * @returns {Promise<Array>} Array of impressions
     */
    async findByAd(adId, options = {}) {
        const queryOptions = {
            where: [['ad_id', '==', adId]],
            orderBy: ['timestamp', 'desc']
        };

        if (options.limit) {
            queryOptions.limit = options.limit;
        }

        return this.findAll(queryOptions);
    }

    /**
     * Count impressions for an ad
     * @param {string} adId - Ad ID
     * @returns {Promise<number>} Impression count
     */
    async countByAd(adId) {
        return this.count({
            where: [['ad_id', '==', adId]]
        });
    }
}
