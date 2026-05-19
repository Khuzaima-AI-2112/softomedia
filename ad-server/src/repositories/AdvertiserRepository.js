import { BaseRepository } from './BaseRepository.js';
import logger from '../utils/logger.js';

export class AdvertiserRepository extends BaseRepository {
    constructor() {
        super('advertisers');
    }

    /**
     * Soft-delete: sets status to 'suspended' and stamps updated_at.
     * Campaigns reference advertiserid so we never hard-delete.
     */
    async softDelete(id) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`Advertiser ${id} not found`);
        }

        try {
            if (this.collection) {
                await this.breaker.execute(() =>
                    this.collection.doc(id).update({
                        status: 'suspended',
                        updated_at: new Date().toISOString()
                    })
                );
            }
        } catch (e) {
            logger.error(`softDelete failed for advertisers/${id}`, {
                error: e.message,
                breaker_state: this.breaker.state
            });
            throw e;
        }

        // Keep MOCK_STORAGE in sync via parent update()
        return this.update(id, { status: 'suspended' });
    }
}

export const advertiserRepository = new AdvertiserRepository();
