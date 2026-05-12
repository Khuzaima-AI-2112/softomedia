import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { generateSignedUrl } from '../utils/storage.js';
import { logger } from '../utils/logger.js';
import { replacementService } from '../services/ReplacementService.js';

const router = express.Router();
const firestore = new Firestore();
const adsCollection = firestore.collection('ads');

/**
 * GET /api/ads
 * List ads — optional filters: ?campaign_id=&status=&limit=
 */
router.get('/', async (req, res) => {
    try {
        const { campaign_id, status, limit = 100 } = req.query;

        let query = adsCollection;

        if (campaign_id) {
            query = query.where('campaign_id', '==', campaign_id);
        }
        if (status) {
            query = query.where('status', '==', status);
        }

        query = query.limit(parseInt(limit, 10));

        const snapshot = await query.get();
        const ads = [];

        for (const doc of snapshot.docs) {
            const adData = doc.data();
            let thumbnail_url = null;

            if (adData.storage_path) {
                try {
                    thumbnail_url = await generateSignedUrl(adData.storage_path);
                } catch (urlErr) {
                    logger.warn(`Failed to generate signed URL for ad ${doc.id}:`, urlErr);
                }
            }

            ads.push({
                id: doc.id,
                ...adData,
                thumbnail_url,
            });
        }

        res.json({ ads, total: ads.length });
    } catch (error) {
        logger.error('Error fetching ads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/ads/:id
 * Get a single ad with signed asset URL
 */
router.get('/:id', async (req, res) => {
    try {
        const doc = await adsCollection.doc(req.params.id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Ad not found' });
        }

        const adData = doc.data();
        let thumbnail_url = null;

        if (adData.storage_path) {
            try {
                thumbnail_url = await generateSignedUrl(adData.storage_path);
            } catch (urlErr) {
                logger.warn(`Failed to generate signed URL for ad ${doc.id}:`, urlErr);
            }
        }

        res.json({ id: doc.id, ...adData, thumbnail_url });
    } catch (error) {
        logger.error('Error fetching ad:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/ads/:id/review
 * Admin approve or reject an ad.
 * Body: { status: 'approved' | 'rejected', rejection_reason?: string, reviewed_by?: string }
 *
 * On rejection: ReplacementService scans loops within the next 2 hours and
 * auto-fills any affected slot with a placeholder, then signals RTDB so
 * players refresh their queue within the 10-second SLA.
 */
router.put('/:id/review', async (req, res) => {
    try {
        const { status, rejection_reason, reviewed_by } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
        }

        const docRef = adsCollection.doc(req.params.id);
        const doc    = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Ad not found' });
        }

        const update = {
            status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewed_by || null,
        };

        if (status === 'rejected' && rejection_reason) {
            update.rejection_reason = rejection_reason;
        } else if (status === 'approved') {
            update.rejection_reason = null;
        }

        await docRef.update(update);

        // ── Replacement automation (BE-3.2) ──────────────────────────────────
        // Fire-and-await so the HTTP response already carries replacement_meta,
        // but we never let a replacement failure block the review response.
        let replacement_meta = null;
        if (status === 'rejected') {
            try {
                const adData = { id: req.params.id, ...doc.data() };
                replacement_meta = await replacementService.handleRejection(
                    req.params.id,
                    adData
                );

                logger.info('[Ads API] Replacement automation complete', {
                    adId: req.params.id,
                    ...replacement_meta
                });
            } catch (replErr) {
                // Non-fatal — log and continue so the review itself still succeeds
                logger.error('[Ads API] ReplacementService error (non-fatal)', {
                    adId: req.params.id,
                    error: replErr.message
                });
            }
        }

        const updated = await docRef.get();
        res.json({
            id: updated.id,
            ...updated.data(),
            ...(replacement_meta ? { replacement_meta } : {})
        });
    } catch (error) {
        logger.error('Error reviewing ad:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/ads/:id
 * Soft-delete an ad by setting status to 'deleted'
 */
router.delete('/:id', async (req, res) => {
    try {
        const docRef = adsCollection.doc(req.params.id);
        const doc    = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Ad not found' });
        }

        await docRef.update({
            status: 'deleted',
            deleted_at: new Date().toISOString(),
        });

        res.json({ message: 'Ad deleted', id: req.params.id });
    } catch (error) {
        logger.error('Error deleting ad:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
