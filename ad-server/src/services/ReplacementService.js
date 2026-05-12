/**
 * ReplacementService
 * Sprint 3 — BE-3.2
 *
 * When an ad is rejected via PUT /api/ads/:id/review the review handler calls
 * ReplacementService.handleRejection(adId, adData).  This service:
 *
 *   1. Finds every active loop scheduled within the next 2 hours that contains
 *      the rejected ad.
 *   2. Resolves the best replacement asset:
 *        a. retailer's designated placeholder (ad.retailer_id → placeholder_asset_id)
 *        b. house ad fallback (type='house', status='approved')
 *   3. Calls loopRepository.replaceSlot() for each affected slot.
 *   4. Pushes a queue-refresh signal to Firebase Realtime Database so players
 *      pick up the change within the 10-second SLA.
 */

import { getDatabase } from 'firebase-admin/database';
import { Firestore }    from '@google-cloud/firestore';
import { loopRepository, SLOT_STATUS } from '../repositories/LoopRepository.js';
import { logger } from '../utils/logger.js';

const db = new Firestore();

// How far ahead (ms) we consider a loop "active / at risk"
const REPLACEMENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export class ReplacementService {
    /**
     * Entry point called by PUT /api/ads/:id/review when status === 'rejected'.
     *
     * @param {string} adId     – The rejected ad's Firestore document ID
     * @param {object} adData   – Full ad document (campaign_id, retailer_id, …)
     * @returns {Promise<{ replaced: number, loops: string[] }>}
     */
    async handleRejection(adId, adData) {
        logger.info('[ReplacementService] Handling rejection', { adId });

        // ── Step 1: find at-risk loops ───────────────────────────────────────
        const atRiskLoops = await this._findAtRiskLoops(adId);

        if (atRiskLoops.length === 0) {
            logger.info('[ReplacementService] No active loops affected', { adId });
            return { replaced: 0, loops: [] };
        }

        // ── Step 2: resolve replacement asset ───────────────────────────────
        const replacementAssetId = await this._resolveReplacementAsset(adData);

        if (!replacementAssetId) {
            logger.warn('[ReplacementService] No replacement asset found, cannot auto-fill', { adId });
            return { replaced: 0, loops: [] };
        }

        // ── Step 3 & 4: replace each affected slot + push RTDB refresh ───────
        const affectedLoopIds = [];

        for (const { loop, slotPosition } of atRiskLoops) {
            try {
                await loopRepository.replaceSlot(loop.id, slotPosition, replacementAssetId);

                logger.info('[ReplacementService] Slot replaced', {
                    loopId: loop.id,
                    slotPosition,
                    replacementAssetId
                });

                // Push refresh signal so the player flushes its queue
                await this._pushRTDBRefresh(loop);

                affectedLoopIds.push(loop.id);
            } catch (err) {
                logger.error('[ReplacementService] Failed to replace slot', {
                    loopId: loop.id,
                    slotPosition,
                    error: err.message
                });
            }
        }

        return { replaced: affectedLoopIds.length, loops: affectedLoopIds };
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Return all { loop, slotPosition } pairs where the loop is scheduled
     * within the next 2 hours AND contains the given adId in one of its slots.
     */
    async _findAtRiskLoops(adId) {
        const now      = new Date();
        const cutoff   = new Date(now.getTime() + REPLACEMENT_WINDOW_MS);
        const today    = now.toISOString().split('T')[0];
        const nowHour  = now.getHours();
        const cutHour  = cutoff.getHours();

        // Fetch loops for today (and tomorrow if the 2h window crosses midnight)
        const dates = [today];
        if (cutoff.toISOString().split('T')[0] !== today) {
            dates.push(cutoff.toISOString().split('T')[0]);
        }

        const results = [];

        for (const date of dates) {
            let loops;
            try {
                loops = await loopRepository.findByDate(date);
            } catch (err) {
                logger.error('[ReplacementService] Could not fetch loops for date', { date, error: err.message });
                continue;
            }

            for (const loop of loops) {
                // Only consider loops that are approved/live and within the window
                const loopHour = loop.hour;
                const isToday  = date === today;

                const withinWindow = isToday
                    ? loopHour >= nowHour && loopHour <= cutHour
                    : loopHour <= cutHour;  // tomorrow: any hour up to cutoff

                if (!withinWindow) continue;
                if (!['APPROVED', 'LIVE'].includes(loop.status)) continue;

                const slots = loop.slots || [];
                slots.forEach((slot, idx) => {
                    // Match on asset_id (direct creative) or campaign_id lineage
                    if (
                        slot.asset_id === adId &&
                        slot.status !== SLOT_STATUS.REPLACED
                    ) {
                        results.push({ loop, slotPosition: idx });
                    }
                });
            }
        }

        return results;
    }

    /**
     * Resolve the best available replacement asset for the affected ad.
     *
     * Priority:
     *   1. Retailer's designated placeholder_asset_id (stored on the retailer doc)
     *   2. Any approved house ad (type === 'house')
     */
    async _resolveReplacementAsset(adData) {
        // 1. Try retailer placeholder
        if (adData.retailer_id) {
            try {
                const retailerDoc = await db
                    .collection('retailers')
                    .doc(adData.retailer_id)
                    .get();

                if (retailerDoc.exists) {
                    const placeholder = retailerDoc.data().placeholder_asset_id;
                    if (placeholder) {
                        logger.info('[ReplacementService] Using retailer placeholder', { placeholder });
                        return placeholder;
                    }
                }
            } catch (err) {
                logger.warn('[ReplacementService] Failed to fetch retailer placeholder', { error: err.message });
            }
        }

        // 2. Fallback: first approved house ad
        try {
            const houseSnap = await db
                .collection('ads')
                .where('type',   '==', 'house')
                .where('status', '==', 'approved')
                .limit(1)
                .get();

            if (!houseSnap.empty) {
                const houseAdId = houseSnap.docs[0].id;
                logger.info('[ReplacementService] Using house ad fallback', { houseAdId });
                return houseAdId;
            }
        } catch (err) {
            logger.warn('[ReplacementService] Failed to fetch house ad', { error: err.message });
        }

        return null;
    }

    /**
     * Push a queue-refresh signal to Firebase Realtime Database.
     *
     * Path: /screens/{screen_id}/queue_refresh
     * Value: { updated_at: ISO, loop_id, reason: 'replacement' }
     *
     * The player watches this path and re-fetches its playlist on any change.
     * Falls back gracefully if RTDB is unavailable (non-blocking).
     */
    async _pushRTDBRefresh(loop) {
        try {
            const rtdb = getDatabase();

            const screenId = loop.screen_id || loop.location_id || 'ALL';

            // If the loop targets all screens at a location we broadcast to
            // the location-level path; individual players subscribe to both.
            const path = screenId === 'ALL'
                ? `/locations/${loop.location_id}/queue_refresh`
                : `/screens/${screenId}/queue_refresh`;

            await rtdb.ref(path).set({
                updated_at: new Date().toISOString(),
                loop_id:    loop.id,
                reason:     'replacement'
            });

            logger.info('[ReplacementService] RTDB refresh pushed', { path, loopId: loop.id });
        } catch (err) {
            // RTDB push failure must never break the replacement flow
            logger.warn('[ReplacementService] RTDB push failed (non-fatal)', { error: err.message });
        }
    }
}

export const replacementService = new ReplacementService();
