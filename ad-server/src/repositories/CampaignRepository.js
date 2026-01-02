import { BaseRepository } from './BaseRepository.js';

export class CampaignRepository extends BaseRepository {
    constructor() {
        super('campaigns');
    }
}

export const campaignRepository = new CampaignRepository();
