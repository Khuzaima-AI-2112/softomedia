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
        const id = this.collection
            ? this.collection.doc().id
            : `ret_${Date.now()}`;
        return super.create(id, data);
    }

    /**
     * Soft-delete a retailer by setting status to 'inactive'.
     * Preserves referential integrity with stores, screens, loops, impressions.
     * @param {string} id
     * @returns {Promise<object>} Updated snapshot
     */
    async softDelete(id) {
        if (!this.collection) {
            // Memory fallback: update in-memory store
            const existing = await this.findById(id);
            if (!existing) {
                throw new Error(`Retailer document ${id} not found`);
            }
            return this.update(id, { status: 'inactive' });
        }

        const docRef = this.collection.doc(id);

        const snapshot = await this.breaker.execute(() => docRef.get());
        if (!snapshot.exists) {
            throw new Error(`Retailer document ${id} not found`);
        }

        await this.breaker.execute(() =>
            docRef.update({
                status: 'inactive',
                updated_at: new Date().toISOString()
            })
        );

        const updated = await this.breaker.execute(() => docRef.get());
        return { id: updated.id, ...updated.data() };
    }

    /**
     * Update the status of a retailer.
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

        await this.breaker.execute(() =>
            docRef.update({
                status,
                updated_at: new Date().toISOString()
            })
        );

        const updated = await this.breaker.execute(() => docRef.get());
        return { id: updated.id, ...updated.data() };
    }
}

export const retailerRepository = new RetailerRepository();
