import { campaignRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

export class CampaignService {
    /**
     * Update campaign status
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

        return campaignRepository.update(id, { status });
    }
}

export const campaignService = new CampaignService();
