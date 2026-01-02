import { BaseRepository } from './BaseRepository.js';

export class ScreenRepository extends BaseRepository {
    constructor() {
        super('screens');
    }

    /**
     * Find active screens for a location
     * @param {string} locationId 
     * @returns {Promise<Array>}
     */
    async findByLocation(locationId) {
        return this.findAll({
            where: [['location_id', '==', locationId], ['status', '==', 'ONLINE']]
        });
    }

    /**
     * Update last seen timestamp
     * @param {string} id 
     * @param {string} status 
     */
    async updateHeartbeat(id, status = 'ONLINE') {
        return this.update(id, {
            last_seen: new Date().toISOString(),
            status
        });
    }
}

export const screenRepository = new ScreenRepository();
