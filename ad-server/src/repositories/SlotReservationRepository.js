import { BaseRepository, commitMockStorage, hasMockRecord } from './BaseRepository.js';

/** One or more Slots were reserved by someone else first. */
export class SlotTakenError extends Error {
    constructor(slots) {
        super('Slot already reserved');
        this.name = 'SlotTakenError';
        this.slots = slots;
    }
}

// Firestore's gRPC status for a create() of a document that already exists.
const ALREADY_EXISTS = 6;

const slotOf = ({ store_id: storeId, date, hour, position }) => ({ store_id: storeId, date, hour, position });

/**
 * Slot Reservations (ADR 0005). A Reservation's document ID is its Slot's
 * Store, date, hour and position, so a Slot can be held only once.
 */
export class SlotReservationRepository extends BaseRepository {
    constructor() {
        super('slot_reservations');
    }

    idFor({ store_id: storeId, date, hour, position }) {
        return `${storeId}_${date}_${hour}_${position}`;
    }

    findForStoreAndDate(storeId, date) {
        return this.findAll({ where: [['store_id', '==', storeId], ['date', '==', date]] });
    }

    /**
     * A Store's held Reservations for this date and later. The date is compared
     * here, not queried: equality filters alone need no composite index.
     */
    async findHeldForStoreFrom(storeId, fromDate) {
        const held = await this.findAll({ where: [['store_id', '==', storeId], ['status', '==', 'held']] });
        return held.filter(reservation => reservation.date >= fromDate);
    }

    /**
     * Creates a Campaign and a Reservation for each of its Slots, all or none.
     * Throws SlotTakenError naming the Slots someone else already holds.
     * @param {object} campaignRepository - Where the Campaign is written
     * @param {object} campaign - The complete Campaign record, id included
     * @param {Array} reservations - Complete Reservation records, without ids
     */
    async reserveForCampaign(campaignRepository, campaign, reservations) {
        const now = new Date().toISOString();
        const records = reservations.map(reservation => ({
            ...reservation, id: this.idFor(reservation), created_at: now, updated_at: now,
        }));
        const campaignRecord = { ...campaign, created_at: campaign.created_at || now, updated_at: now };

        if (this.db && campaignRepository.db === this.db) {
            try {
                await this.db.runTransaction(async transaction => {
                    const refs = records.map(record => this.collection.doc(record.id));
                    const existing = await transaction.getAll(...refs);
                    const taken = records.filter((_, index) => existing[index].exists);
                    if (taken.length > 0) throw new SlotTakenError(taken.map(slotOf));
                    refs.forEach((ref, index) => transaction.create(ref, records[index]));
                    transaction.create(campaignRepository.collection.doc(campaignRecord.id), campaignRecord);
                });
            } catch (error) {
                if (error.code !== ALREADY_EXISTS) throw error;
                // Lost a race after the read: name the Slots that are now held.
                const existing = await Promise.all(records.map(record => this.collection.doc(record.id).get()));
                throw new SlotTakenError(records.filter((_, index) => existing[index].exists).map(slotOf));
            }
        } else {
            // Memory mode: the check and the write run without yielding, so no
            // concurrent submission can slip between them.
            const taken = records.filter(record => hasMockRecord(this.collectionName, record.id));
            if (taken.length > 0) throw new SlotTakenError(taken.map(slotOf));
        }

        commitMockStorage([
            ...records.map(record => ({ collectionName: this.collectionName, id: record.id, data: record })),
            { collectionName: campaignRepository.collectionName, id: campaignRecord.id, data: campaignRecord },
        ]);
        return campaignRecord;
    }
}

export const slotReservationRepository = new SlotReservationRepository();
export default slotReservationRepository;
