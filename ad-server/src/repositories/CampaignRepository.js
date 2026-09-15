import { BaseRepository } from './BaseRepository.js';

export class CampaignRepository extends BaseRepository {
    constructor() {
        super('campaigns');
    }

    brandIdOf(campaign) {
        return campaign?.brand_id || campaign?.advertiser_id || null;
    }

    isOwnedByBrand(campaign, brandId) {
        return Boolean(brandId) && this.brandIdOf(campaign) === brandId;
    }

    /**
     * Whether the Campaign books Stores at this Retailer. A Campaign without an
     * inventory selection or a Retailer is network-wide, matching loop generation.
     */
    targetsRetailer(campaign, retailerId) {
        if (!retailerId) return false;
        const selections = Array.isArray(campaign?.inventory_selection) ? campaign.inventory_selection : [];
        if (selections.length > 0) {
            return selections.some(selection => selection.retailer_id === retailerId);
        }
        return !campaign?.retailer_id || campaign.retailer_id === retailerId;
    }

    async findByBrandId(brandId, status) {
        const [canonical, legacy] = await Promise.all([
            this.findAll({ where: [['brand_id', '==', brandId]] }),
            this.findAll({ where: [['advertiser_id', '==', brandId]] }),
        ]);
        const campaigns = [...new Map([...canonical, ...legacy]
            .map(campaign => [campaign.id, campaign])).values()];
        return campaigns.filter(campaign => this.isOwnedByBrand(campaign, brandId)
            && (!status || campaign.status === status));
    }

    createForBrand(id, data, brandId) {
        return this.create(id, {
            ...data,
            brand_id: brandId,
            // Compatibility boundary for legacy readers pending schema migration.
            advertiser_id: brandId,
        });
    }
}

export const campaignRepository = new CampaignRepository();
