import { BaseRepository } from './BaseRepository.js';

import { FieldValue } from '@google-cloud/firestore';
import { commitMockStorage } from './BaseRepository.js';

export class ImpressionRepository extends BaseRepository {
    constructor() {
        super('impressions');
        this.memoryTransaction = Promise.resolve();
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

    async recordProofOfPlay(data, campaignRepository) {
        const event = this.buildProofOfPlay(data);
        if (this.collection) {
            return this.breaker.execute(() => this.db.runTransaction(async transaction => {
                const eventRef = this.collection.doc(data.event_id);
                const campaignRef = this.db.collection('campaigns').doc(data.campaign_id);
                const [existingEvent, campaign] = await Promise.all([
                    transaction.get(eventRef),
                    transaction.get(campaignRef),
                ]);
                if (existingEvent.exists) {
                    return { status: 'duplicate', event: { id: existingEvent.id, ...existingEvent.data() } };
                }
                if (!campaign.exists) throw new Error('Campaign not found');

                transaction.create(eventRef, event);
                transaction.update(campaignRef, {
                    play_count: FieldValue.increment(1),
                    last_played_at: data.presentation_started_at,
                    updated_at: event.updated_at,
                });
                return { status: 'recorded', event };
            }));
        }

        const execute = async () => {
            const existing = await this.findById(data.event_id);
            if (existing) return { status: 'duplicate', event: existing };
            const campaign = await campaignRepository.findById(data.campaign_id);
            if (!campaign) throw new Error('Campaign not found');
            const updatedAt = new Date().toISOString();
            commitMockStorage([
                {
                    collectionName: 'campaigns',
                    id: data.campaign_id,
                    data: {
                        ...campaign,
                        play_count: (campaign.play_count || 0) + 1,
                        last_played_at: data.presentation_started_at,
                        updated_at: updatedAt,
                    },
                },
                { collectionName: this.collectionName, id: data.event_id, data: event },
            ]);
            return { status: 'recorded', event };
        };
        const result = this.memoryTransaction.then(execute, execute);
        this.memoryTransaction = result.then(() => undefined, () => undefined);
        return result;
    }

    buildProofOfPlay(data) {
        const now = new Date().toISOString();
        return {
            ...data,
            id: data.event_id,
            impression_id: data.event_id,
            proof_of_play_id: data.event_id,
            played_at: data.presentation_started_at,
            timestamp: data.presentation_started_at,
            playback_kind: 'campaign_delivery',
            created_at: now,
            updated_at: now,
        };
    }

    async findProofsOfPlayByCampaign(campaignId) {
        const records = await this.findByCampaign(campaignId);
        return records
            .filter(record => record.asset_id && record.screen_id && record.loop_id
                && Number.isInteger(record.slot_position)
                && (record.played_at || record.timestamp))
            .map(record => ({
                id: record.proof_of_play_id || record.impression_id || record.id,
                event_id: record.event_id || record.proof_of_play_id || record.impression_id || record.id,
                campaign_id: record.campaign_id,
                asset_id: record.asset_id,
                screen_id: record.screen_id,
                location_id: record.location_id,
                loop_id: record.loop_id,
                slot_position: record.slot_position,
                presentation_started_at: record.presentation_started_at || record.played_at || record.timestamp,
                intended_duration_seconds: record.intended_duration_seconds,
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
