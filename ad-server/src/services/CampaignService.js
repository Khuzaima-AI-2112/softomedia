import { campaignRepository, adRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

export class CampaignService {
    /**
     * Update campaign status and trigger side-effects
     * @param {string} id 
     * @param {string} status - 'approved', 'rejected'
     * @returns {Promise<object>} Updated campaign
     */
    async updateStatus(id, status) {
        logger.info('Updating campaign status', { id, status });

        const campaign = await campaignRepository.findById(id);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        const updatedCampaign = await campaignRepository.update(id, { status });

        // If approved, generate "Ad" documents for the player
        if (status === 'approved') {
            await this.generateAdsFromCampaign(updatedCampaign);
        }

        return updatedCampaign;
    }

    /**
     * Create individual Ad records for each slot in the campaign
     * @param {object} campaign 
     */
    async generateAdsFromCampaign(campaign) {
        logger.info('Generating ads for approved campaign', { id: campaign.id });

        const { media_id, selectedSlots = [], title } = campaign;

        // In a real system, we'd look up the media URL here
        const mockUrl = `https://placehold.co/1920x1080?text=${encodeURIComponent(title)}`;

        for (const slot of selectedSlots) {
            const adId = `ad_${campaign.id}_${slot.replace(/[:\s]/g, '_')}`;
            await adRepository.create(adId, {
                campaign_id: campaign.id,
                media_id,
                title,
                content_url: mockUrl,
                status: 'approved',
                scheduled_slot: slot,
                created_at: new Date().toISOString()
            });
        }
    }
}

export const campaignService = new CampaignService();
