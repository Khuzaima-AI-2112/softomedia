import { randomUUID } from 'node:crypto';
import { BaseRepository, commitMockStorage, readMockRecord } from './BaseRepository.js';

export { CREATIVE_STATUS } from '../constants/creatives.js';

/** The Creative's status changed before this decision could be made. */
export class CreativeStatusConflictError extends Error {
    constructor(currentStatus) {
        super(`The Creative is ${currentStatus}`);
        this.name = 'CreativeStatusConflictError';
    }
}

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

    /**
     * Records a decision on a Creative that is still in the `from` status, checked
     * and written together so two decisions at once can't both succeed.
     * @returns {Promise<object|null>} The decided Creative, or null if there is none
     * @throws {CreativeStatusConflictError} When the Creative is no longer `from`
     */
    async decide(id, from, decision) {
        const decide = current => {
            if (!current) return null;
            if (current.approval_status !== from) throw new CreativeStatusConflictError(current.approval_status);
            return { ...current, ...decision, updated_at: new Date().toISOString() };
        };

        let decided;
        if (this.collection) {
            const ref = this.collection.doc(id);
            decided = await this.db.runTransaction(async transaction => {
                const snapshot = await transaction.get(ref);
                const next = decide(snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);
                if (next) transaction.set(ref, next);
                return next;
            });
        } else {
            // Memory mode: the check and the write run without yielding in between.
            decided = decide(readMockRecord(this.collectionName, id));
        }
        if (decided) commitMockStorage([{ collectionName: this.collectionName, id, data: decided }]);
        return decided;
    }

    /** The Creative a stored file belongs to, or null. */
    async findForAsset(asset) {
        return asset?.creative_id ? this.findById(asset.creative_id) : null;
    }

    /**
     * The Creative a stored file belongs to, and the ids of every file that
     * plays with it, in play order: the Creative's, or just the file's own.
     */
    async withFilesFor(asset) {
        const creative = await this.findForAsset(asset);
        return { creative, mediaIds: creative?.media_ids?.length ? creative.media_ids : [asset.id] };
    }
}

export const creativeRepository = new CreativeRepository();
