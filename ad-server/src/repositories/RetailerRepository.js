import { BaseRepository } from './BaseRepository.js';

export class RetailerRepository extends BaseRepository {
    constructor() {
        super('retailers');
    }

    /**
     * Create a new retailer with a server-generated auto-ID.
     * Use this from the API layer instead of BaseRepository.create(id, data)
     * so the client never controls the document ID.
     * @param {object} data - Retailer fields (name, contact_email, contract_start, logo, status)
     * @returns {Promise<object>} Created retailer document with id
     */
    async createNew(data) {
        const id = data.id || (this.collection
            ? this.collection.doc().id
            : `ret_${Date.now()}`);
        const { id: _, ...recordData } = data; // remove id from the document payload itself
        return super.create(id, recordData);
    }

    /**
     * Soft-delete a retailer by setting status to 'inactive' and stamping deleted_at.
     * deleted_at is the canonical deletion marker — distinguishes delete from the
     * PATCH status toggle which also sets status: 'inactive' but does NOT set deleted_at.
     * Preserves referential integrity with stores, screens, loops, impressions.
     * @param {string} id
     * @returns {Promise<object>} Updated snapshot
     */
    async softDelete(id) {
        const deletedAt = new Date().toISOString();

        if (!this.collection) {
            // Memory fallback: update in-memory store
            const existing = await this.findById(id);
            if (!existing) {
                throw new Error(`Retailer document ${id} not found`);
            }
            return this.update(id, { status: 'inactive', deleted_at: deletedAt });
        }

        const docRef = this.collection.doc(id);

        const snapshot = await this.breaker.execute(() => docRef.get());
        if (!snapshot.exists) {
            throw new Error(`Retailer document ${id} not found`);
        }

        // Use set+merge instead of update() to avoid NOT_FOUND throws
        // on documents that exist in Firestore but may not yet have all fields.
        await this.breaker.execute(() =>
            docRef.set({
                status: 'inactive',
                deleted_at: deletedAt,
                updated_at: deletedAt
            }, { merge: true })
        );

        const updated = await this.breaker.execute(() => docRef.get());
        return { id: updated.id, ...updated.data() };
    }

    /**
     * Update the status of a retailer (intentional deactivation/reactivation toggle).
     * Does NOT set deleted_at — this is not a deletion.
     * @param {string} id
     * @param {string} status - 'active' or 'inactive'
     * @returns {Promise<object>} Updated snapshot
     */
    async updateStatus(id, status) {
        if (!this.collection) {
            // Memory fallback
            const existing = await this.findById(id);
            if (!existing) {
                throw new Error(`Retailer document ${id} not found`);
            }
            return this.update(id, { status });
        }

        const docRef = this.collection.doc(id);

        const snapshot = await this.breaker.execute(() => docRef.get());
        if (!snapshot.exists) {
            throw new Error(`Retailer document ${id} not found`);
        }

        // Use set+merge instead of update() to avoid NOT_FOUND throws
        // on documents that exist in Firestore but may not yet have all fields.
        await this.breaker.execute(() =>
            docRef.set({
                status,
                updated_at: new Date().toISOString()
            }, { merge: true })
        );

        const updated = await this.breaker.execute(() => docRef.get());
        return { id: updated.id, ...updated.data() };
    }
}

export const retailerRepository = new RetailerRepository();
