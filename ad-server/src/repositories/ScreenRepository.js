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
    async updateHeartbeat(id, status = 'ONLINE', seenAt = new Date()) {
        return this.update(id, {
            last_seen: seenAt.toISOString(),
            status
        });
    }

    /**
     * Update logical status from admin UI.
     * Maps human-friendly `active` / `inactive` to storage values
     * (currently `ONLINE` / `OFFLINE`).
     *
     * @param {string} id
     * @param {'active'|'inactive'} status
     * @returns {Promise<object|null>} Updated document or null if not found
     */
    async updateStatus(id, status) {
        const storageStatus = status === 'active' ? 'ONLINE' : 'OFFLINE';
        const updated = await this.update(id, {
            status: storageStatus,
            updated_at: new Date().toISOString()
        });
        return updated;
    }

    /**
     * Check if a screen is referenced by any active or upcoming campaigns.
     *
     * Implementation notes:
     *   - Uses the shared Firestore db from BaseRepository.
     *   - Treats campaigns with status in ['live', 'approved', 'scheduled'] as blocking.
     *   - Compares dates as ISO strings; assumes campaign documents store
     *     `startdate` and `enddate` in ISO-8601 format (YYYY-MM-DD or full ISO).
     *
     * @param {string} screenId
     * @returns {Promise<boolean>}
     */
    async hasActiveOrUpcomingCampaigns(screenId) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const blockingStatuses = ['live', 'approved', 'scheduled'];

        const snapshot = await this.db
            .collection('campaigns')
            .where('screenid', '==', screenId)
            .where('status', 'in', blockingStatuses)
            .get();

        if (snapshot.empty) return false;

        // Extra safety: ensure date window is today or future
        let hasBlocking = false;
        snapshot.forEach(doc => {
            const data = doc.data() || {};
            const start = (data.startdate || '').slice(0, 10);
            const end = (data.enddate || '').slice(0, 10);
            if (!start || !end) {
                hasBlocking = true;
                return;
            }
            if (end >= today) {
                hasBlocking = true;
            }
        });

        return hasBlocking;
    }
}

export const screenRepository = new ScreenRepository();
