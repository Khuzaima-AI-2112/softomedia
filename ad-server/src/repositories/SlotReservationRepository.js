import { BaseRepository, commitMockStorage, readMockRecord } from './BaseRepository.js';

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

const isHeld = record => record?.status === 'held';

/**
 * Slot Reservations (ADR 0005). A Reservation's document ID is its Slot's
 * Store, date, hour and position, so a Slot can be held only once. A released
 * Reservation keeps its record, with the reason, until the Slot is reserved again.
 */
export class SlotReservationRepository extends BaseRepository {
    constructor() {
        super('slot_reservations');
    }

    idFor({ store_id: storeId, date, hour, position }) {
        return `${storeId}_${date}_${hour}_${position}`;
    }

    findHeldForStoreAndDate(storeId, date) {
        return this.findAll({ where: [['store_id', '==', storeId], ['date', '==', date], ['status', '==', 'held']] });
    }

    findHeldForCampaign(campaignId) {
        return this.findAll({ where: [['campaign_id', '==', campaignId], ['status', '==', 'held']] });
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
                    const taken = records.filter((_, index) => isHeld(existing[index].data()));
                    if (taken.length > 0) throw new SlotTakenError(taken.map(slotOf));
                    // A released Reservation's record is replaced; the read above guards the replacement.
                    refs.forEach((ref, index) => (existing[index].exists
                        ? transaction.set(ref, records[index])
                        : transaction.create(ref, records[index])));
                    transaction.create(campaignRepository.collection.doc(campaignRecord.id), campaignRecord);
                });
            } catch (error) {
                if (error.code !== ALREADY_EXISTS) throw error;
                // Lost a race after the read: name the Slots that are now held.
                const existing = await Promise.all(records.map(record => this.collection.doc(record.id).get()));
                throw new SlotTakenError(records.filter((_, index) => isHeld(existing[index].data())).map(slotOf));
            }
        } else {
            // Memory mode: the check and the write run without yielding, so no
            // concurrent submission can slip between them.
            const taken = records.filter(record => isHeld(readMockRecord(this.collectionName, record.id)));
            if (taken.length > 0) throw new SlotTakenError(taken.map(slotOf));
        }

        commitMockStorage([
            ...records.map(record => ({ collectionName: this.collectionName, id: record.id, data: record })),
            { collectionName: campaignRepository.collectionName, id: campaignRecord.id, data: campaignRecord },
        ]);
        return campaignRecord;
    }

    /**
     * Releases these Reservations with a reason, skipping any no longer held for
     * the same Campaign, so a Reservation is released, and reported, only once.
     * @returns {Promise<Array>} The Reservations this call released
     */
    async release(reservations, reason) {
        const releasedAt = new Date().toISOString();
        const stillHeld = (record, reservation) => isHeld(record) && record.campaign_id === reservation.campaign_id;
        const releasedRecord = record => ({
            ...record, status: 'released', release_reason: reason, released_at: releasedAt, updated_at: releasedAt,
        });

        let released = [];
        if (this.db && reservations.length > 0) {
            released = await this.db.runTransaction(async transaction => {
                const refs = reservations.map(reservation => this.collection.doc(reservation.id));
                const current = await transaction.getAll(...refs);
                const writes = reservations
                    .map((reservation, index) => ({ ref: refs[index], record: current[index].data(), reservation }))
                    .filter(({ record, reservation }) => stillHeld(record, reservation))
                    .map(({ ref, record }) => ({ ref, record: releasedRecord(record) }));
                writes.forEach(({ ref, record }) => transaction.set(ref, record));
                return writes.map(({ record }) => record);
            });
        } else if (!this.db) {
            // Memory mode: read and written without yielding, like reserveForCampaign.
            released = reservations
                .map(reservation => ({ record: readMockRecord(this.collectionName, reservation.id), reservation }))
                .filter(({ record, reservation }) => stillHeld(record, reservation))
                .map(({ record }) => releasedRecord(record));
        }
        commitMockStorage(released.map(record => ({ collectionName: this.collectionName, id: record.id, data: record })));
        return released;
    }
}

export const slotReservationRepository = new SlotReservationRepository();
export default slotReservationRepository;
