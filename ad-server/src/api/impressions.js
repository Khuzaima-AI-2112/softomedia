import express from 'express';
import { impressionRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, normalizeRole, userHasPermission } from '../middleware/requireRole.js';
import { retailerIdFor } from '../middleware/storeManagement.js';

const router = express.Router();

/**
 * GET /api/impressions
 * Query impression records with role-gated visibility.
 *
 * Sprint 13 — S13-3.
 *
 * Supported query params (at least one required):
 *   ?campaign_id=X   — all impressions for a campaign
 *   ?location_id=X   — all impressions for a location
 *   ?screen_id=X     — all impressions for a screen
 *
 * Grants:
 *   - impressions.view_network (Admin, Super Administrator): any filter.
 *   - impressions.view_own (Retailer Administrator): campaign_id or screen_id
 *     only, scoped to the Retailer of the signed-in identity. location_id
 *     queries are rejected with 403 to prevent cross-retailer enumeration.
 *   - Everyone else: 403.
 *
 * Returns 400 when no recognised filter param is provided.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        const networkView = userHasPermission(req.user, PERMISSIONS.IMPRESSION_VIEW_NETWORK);

        if (!networkView && !userHasPermission(req.user, PERMISSIONS.IMPRESSION_VIEW_OWN)) {
            return res.status(403).json({
                error: 'Forbidden',
                required: 'retaileradmin',
                actual: role || 'unauthenticated',
            });
        }

        const { campaign_id, location_id, screen_id } = req.query;

        // Own Retailer only: reject location_id queries, enforce retailer scope
        if (!networkView) {
            if (location_id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'retaileradmin may not query impressions by location_id',
                });
            }
            // For campaign/screen queries we add a retailer_id filter
            const retailerId = retailerIdFor(req.user);
            if (!retailerId) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'retaileradmin account has no linked retailer_id',
                });
            }

            if (campaign_id) {
                const results = await impressionRepository.findAll({
                    where: [
                        ['campaign_id', '==', campaign_id],
                        ['retailer_id', '==', retailerId],
                    ],
                    orderBy: ['timestamp', 'desc'],
                });
                return res.json(results);
            }
            if (screen_id) {
                const results = await impressionRepository.findAll({
                    where: [
                        ['screen_id', '==', screen_id],
                        ['retailer_id', '==', retailerId],
                    ],
                    orderBy: ['timestamp', 'desc'],
                });
                return res.json(results);
            }
            return res.status(400).json({
                error: 'At least one of campaign_id or screen_id is required',
            });
        }

        // Network view: full access
        if (campaign_id) {
            const results = await impressionRepository.findByCampaign(campaign_id);
            return res.json(results);
        }
        if (location_id) {
            const results = await impressionRepository.findByLocation(location_id);
            return res.json(results);
        }
        if (screen_id) {
            const results = await impressionRepository.findAll({
                where: [['screen_id', '==', screen_id]],
                orderBy: ['timestamp', 'desc'],
            });
            return res.json(results);
        }

        return res.status(400).json({
            error: 'At least one of campaign_id, location_id, or screen_id is required',
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
