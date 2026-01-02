import { BaseRepository } from './BaseRepository.js';

export class ImpressionRepository extends BaseRepository {
    constructor() {
        super('impressions');
    }

    /**
     * Log a new impression
     * @param {object} data 
     */
    async logImpression(data) {
        const id = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return this.create(id, {
            ...data,
            // Capture source metadata for analytics
            playlist_source: data.source || 'assigned',
            playlist_id: data.playlistId || data.campaign_id,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Find impressions by campaign
     * @param {string} campaignId 
     */
    async findByCampaign(campaignId) {
        return this.findAll({
            where: [['campaign_id', '==', campaignId]],
            orderBy: ['timestamp', 'desc']
        });
    }

    /**
     * Find impressions by location
     * @param {string} locationId 
     */
    async findByLocation(locationId) {
        return this.findAll({
            where: [['location_id', '==', locationId]],
            orderBy: ['timestamp', 'desc']
        });
    }
}

export const impressionRepository = new ImpressionRepository();
