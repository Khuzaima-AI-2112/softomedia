import { randomUUID } from 'node:crypto';
import { BaseRepository, commitMockStorage, readMockRecord } from './BaseRepository.js';

import { CREATIVE_STATUS } from '../constants/creatives.js';

export { CREATIVE_STATUS };

/** The Creative's status changed before this decision could be made. */
export class CreativeStatusConflictError extends Error {
    constructor(currentStatus) {
        super(`The Creative is ${currentStatus}`);
        this.name = 'CreativeStatusConflictError';
    }
}

/** A Retailer's decision on a Creative can't be recorded now. */
export class RetailerDecisionConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RetailerDecisionConflictError';
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
     * Records the Super Administrator's decision on a Creative that is still in
     * the `from` status, checked and written together so two decisions at once
     * can't both succeed.
     * @returns {Promise<object|null>} The decided Creative, or null if there is none
     * @throws {CreativeStatusConflictError} When the Creative is no longer `from`
     */
    decide(id, from, decision) {
        return this.#change(id, current => {
            if (current.approval_status !== from) throw new CreativeStatusConflictError(current.approval_status);
            return decision;
        });
    }

    /**
     * Records one Retailer's decision on a Creative, for its own Stores. The
     * Super Administrator approves first, and a Retailer decides only once.
     * @returns {Promise<object|null>} The decided Creative, or null if there is none
     * @throws {RetailerDecisionConflictError} When the Retailer may not decide now
     */
    decideForRetailer(id, retailerId, decision) {
        return this.#change(id, current => {
            if (current.approval_status !== CREATIVE_STATUS.APPROVED) {
                throw new RetailerDecisionConflictError('The Super Administrator approves a Creative first');
            }
            if (current.retailer_approvals?.[retailerId]) {
                throw new RetailerDecisionConflictError('Your decision on this Creative is already recorded');
            }
            return { retailer_approvals: { ...current.retailer_approvals, [retailerId]: decision } };
        });
    }

    /**
     * Records one Retailer's revocation of the approval it gave, for its own
     * Stores. Revoking is final: the Retailer never decides on it again (#38).
     * @returns {Promise<object|null>} The revoked Creative, or null if there is none
     * @throws {RetailerDecisionConflictError} When the Retailer has no approval to revoke
     */
    revokeForRetailer(id, retailerId, revocation) {
        return this.#change(id, current => {
            if (current.retailer_approvals?.[retailerId]?.status !== CREATIVE_STATUS.APPROVED) {
                throw new RetailerDecisionConflictError('Only an approval you gave can be revoked');
            }
            return { retailer_approvals: { ...current.retailer_approvals, [retailerId]: revocation } };
        });
    }

    /**
     * Reads a Creative and writes the fields `change` returns for it, in one
     * transaction. `change` may throw to refuse.
     * @returns {Promise<object|null>} The changed Creative, or null if there is none
     */
    async #change(id, change) {
        const apply = current => (current
            ? { ...current, ...change(current), updated_at: new Date().toISOString() }
            : null);

        let changed;
        if (this.collection) {
            const ref = this.collection.doc(id);
            changed = await this.db.runTransaction(async transaction => {
                const snapshot = await transaction.get(ref);
                const next = apply(snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);
                if (next) transaction.set(ref, next);
                return next;
            });
        } else {
            // Memory mode: the check and the write run without yielding in between.
            changed = apply(readMockRecord(this.collectionName, id));
        }
        if (changed) commitMockStorage([{ collectionName: this.collectionName, id, data: changed }]);
        return changed;
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
