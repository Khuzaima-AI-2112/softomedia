import { randomUUID } from 'node:crypto';
import { BaseRepository } from './BaseRepository.js';

export const CREATIVE_STATUS = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVOKED: 'revoked',
});

/**
 * A Creative is a Brand's advertisement: its uploaded file(s) in order, and
 * the approval that belongs to it rather than to a Campaign, loop or Slot.
 */
export class CreativeRepository extends BaseRepository {
    constructor() {
        super('creatives');
    }

    newId() {
        return `crv_${randomUUID()}`;
    }

    findForBrand(brandId) {
        return this.findAll({ where: [['brand_id', '==', brandId]] });
    }

    /** The Creative a stored file belongs to, or null. */
    async findForAsset(asset) {
        return asset?.creative_id ? this.findById(asset.creative_id) : null;
    }
}

export const creativeRepository = new CreativeRepository();
