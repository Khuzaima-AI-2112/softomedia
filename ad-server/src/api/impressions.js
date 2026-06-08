import express from 'express';
import { impressionRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, ROLE_HIERARCHY, normalizeRole } from '../middleware/requireRole.js';

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
 * Role rules:
 *   - contentmanager (level 3) and above: unrestricted access to any filter.
 *   - retaileradmin  (level 1): may only query by campaign_id or screen_id;
 *     request is auto-scoped so that only records whose retailer_id matches
 *     their JWT linkedentityid are returned.  location_id queries are
 *     rejected with 403 to prevent cross-retailer enumeration.
 *   - Lower roles / unauthenticated: 403.
 *
 * Returns 400 when no recognised filter param is provided.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        const userLevel = ROLE_HIERARCHY[role] ?? -1;
        const contentManagerLevel = ROLE_HIERARCHY['contentmanager']; // 3
        const retailerAdminLevel  = ROLE_HIERARCHY['retaileradmin'];  // 1

        if (userLevel < retailerAdminLevel) {
            return res.status(403).json({
                error: 'Forbidden',
                required: 'retaileradmin',
                actual: role || 'unauthenticated',
            });
        }

        const { campaign_id, location_id, screen_id } = req.query;

        // retaileradmin: reject location_id queries, enforce retailer scope
        if (userLevel < contentManagerLevel) {
            if (location_id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'retaileradmin may not query impressions by location_id',
                });
            }
            // For campaign/screen queries we add a retailer_id filter
            const retailerId = req.user.linkedentityid || req.user.retailer_id;
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

        // contentmanager and above: full access
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
