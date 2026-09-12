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

    async findProofsOfPlayByCampaign(campaignId) {
        const records = await this.findByCampaign(campaignId);
        return records
            .filter(record => record.asset_id && record.screen_id && record.loop_id
                && Number.isInteger(record.slot_position)
                && (record.played_at || record.timestamp))
            .map(record => ({
                id: record.proof_of_play_id || record.impression_id || record.id,
                campaign_id: record.campaign_id,
                asset_id: record.asset_id,
                screen_id: record.screen_id,
                loop_id: record.loop_id,
                slot_position: record.slot_position,
                played_at: record.played_at || record.timestamp,
            }));
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
