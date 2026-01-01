// Screen Repository
// Handles all screen-related database operations

import { BaseRepository } from './BaseRepository.js';

export class ScreenRepository extends BaseRepository {
    constructor() {
        super('screens');
    }

    /**
     * Update screen last seen timestamp
     * @param {string} screenId - Screen ID
     * @returns {Promise<object>} Updated screen document
     */
    async updateLastSeen(screenId) {
        const exists = await this.exists(screenId);

        if (exists) {
            return this.update(screenId, {
                last_seen: new Date().toISOString(),
                status: 'active'
            });
        } else {
            return this.create(screenId, {
                screen_id: screenId,
                status: 'active',
                last_seen: new Date().toISOString()
            });
        }
    }

    /**
     * Find active screens (seen in last 5 minutes)
     * @returns {Promise<Array>} Array of active screens
     */
    async findActive() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        return this.findAll({
            where: [
                ['status', '==', 'active'],
                ['last_seen', '>=', fiveMinutesAgo]
            ]
        });
    }
}
