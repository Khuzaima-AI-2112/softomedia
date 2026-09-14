import { BaseRepository, commitMockStorage } from './BaseRepository.js';

export class SupportTicketRepository extends BaseRepository {
    constructor() {
        super('support_tickets');
        this.memoryTransaction = Promise.resolve();
    }

    findByRetailer(retailerId) {
        return this.findAll({ where: [['retailer_id', '==', retailerId]] });
    }

    /**
     * Atomically replace a ticket with `change(currentTicket)`.
     * Resolves to null when the ticket does not exist.
     */
    async applyChange(id, change) {
        if (this.collection) {
            const next = await this.breaker.execute(() => this.db.runTransaction(async transaction => {
                const ref = this.collection.doc(id);
                const snapshot = await transaction.get(ref);
                if (!snapshot.exists) return null;
                const changed = {
                    ...change({ id: snapshot.id, ...snapshot.data() }),
                    updated_at: new Date().toISOString(),
                };
                transaction.set(ref, changed);
                return changed;
            }));
            if (next) commitMockStorage([{ collectionName: this.collectionName, id, data: next }]);
            return next;
        }

        const execute = async () => {
            const existing = await this.findById(id);
            if (!existing) return null;
            const changed = { ...change(existing), updated_at: new Date().toISOString() };
            commitMockStorage([{ collectionName: this.collectionName, id, data: changed }]);
            return changed;
        };
        const result = this.memoryTransaction.then(execute, execute);
        this.memoryTransaction = result.then(() => undefined, () => undefined);
        return result;
    }
}

export const supportTicketRepository = new SupportTicketRepository();
