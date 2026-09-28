import { BaseRepository } from './BaseRepository.js';
import { DEFAULT_DAYPARTS, DAYPART_NAMES } from '../services/Dayparts.js';

const DOCUMENT_ID = 'dayparts';

/** Just the breakfast, lunch and dinner hours, whatever else the source carries. */
const hoursOf = source => Object.fromEntries(DAYPART_NAMES.map(name => [
    name, { start: source[name].start, end: source[name].end },
]));

/** The network's Dayparts, kept with the platform configuration. */
export class DaypartRepository extends BaseRepository {
    constructor() {
        super('platform_config');
    }

    /** The saved Dayparts, or the defaults until the Super Administrator sets them. */
    async get() {
        return hoursOf(await this.findById(DOCUMENT_ID) || DEFAULT_DAYPARTS);
    }

    /**
     * Saves validated Dayparts with their audit record, both or neither.
     * Demo reset restores the defaults.
     */
    async saveWithAudit(dayparts, auditRepository, auditEntry) {
        const data = hoursOf(dayparts);

        if (this.db && auditRepository.db === this.db) {
            const audit = auditRepository.buildRecord(auditEntry);
            const now = new Date().toISOString();
            await this.db.runTransaction(async (transaction) => {
                transaction.set(this.collection.doc(DOCUMENT_ID), { ...data, updated_at: now }, { merge: true });
                transaction.create(auditRepository.collection.doc(audit.id), { ...audit, created_at: now, updated_at: now });
            });
            return this.get();
        }

        // Memory mode keeps the same outcome: a failed save removes its audit record.
        const audit = await auditRepository.record(auditEntry);
        try {
            await this.update(DOCUMENT_ID, data);
        } catch (error) {
            await auditRepository.delete(audit.id);
            throw error;
        }
        return this.get();
    }
}

export const daypartRepository = new DaypartRepository();
