import { BaseRepository } from './BaseRepository.js';
import logger from '../utils/logger.js';

export class AdvertiserRepository extends BaseRepository {
    constructor() {
        super('advertisers');
    }

    /**
     * Soft-delete: sets status to 'suspended' and stamps deleted_at.
     * deleted_at is the canonical deletion marker.
     * status: 'suspended' is preserved for campaign referential integrity —
     * campaign documents reference advertiser_id and must not be orphaned.
     * Campaigns referencing this advertiser are unaffected by this operation.
     */
    async softDelete(id) {
        const deletedAt = new Date().toISOString();

        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`Advertiser ${id} not found`);
        }

        try {
            if (this.collection) {
                // Use set+merge instead of update() to avoid NOT_FOUND throws
                // on documents that exist in Firestore but may not yet have all fields.
                await this.breaker.execute(() =>
                    this.collection.doc(id).set({
                        status: 'suspended',
                        deleted_at: deletedAt,
                        updated_at: deletedAt
                    }, { merge: true })
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
        return this.update(id, { status: 'suspended', deleted_at: deletedAt });
    }
}

export const advertiserRepository = new AdvertiserRepository();
