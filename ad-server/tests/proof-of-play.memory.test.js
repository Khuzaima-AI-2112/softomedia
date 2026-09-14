import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { campaignRepository } = await import('../src/repositories/CampaignRepository.js');
const { impressionRepository } = await import('../src/repositories/ImpressionRepository.js');

describe('memory Proof of Play transaction', () => {
    beforeEach(() => clearMockStorage());

    test('publishes one event and one Campaign increment for concurrent duplicates', async () => {
        await campaignRepository.create('campaign-one', { play_count: 0 });
        const event = {
            event_id: 'event-one',
            campaign_id: 'campaign-one',
            screen_id: 'screen-one',
            location_id: 'location-one',
            loop_id: 'loop-one',
            slot_position: 0,
            asset_id: 'asset-one',
            presentation_started_at: new Date().toISOString(),
            intended_duration_seconds: 5,
        };

        const results = await Promise.all([
            impressionRepository.recordProofOfPlay(event, campaignRepository),
            impressionRepository.recordProofOfPlay(event, campaignRepository),
        ]);

        expect(results.map(result => result.status).sort()).toEqual(['duplicate', 'recorded']);
        await expect(impressionRepository.findById(event.event_id)).resolves.toEqual(
            expect.objectContaining({ event_id: event.event_id })
        );
        await expect(campaignRepository.findById(event.campaign_id)).resolves.toEqual(
            expect.objectContaining({ play_count: 1 })
        );
    });
});
