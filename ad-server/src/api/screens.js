import express from 'express';
import { screenRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, ROLE_HIERARCHY, normalizeRole } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * POST /api/screens/register
 * Register a new screen in the network.
 * Stores store_id as location_id in Firestore (internal field name).
 */
router.post('/register', authenticate, async (req, res) => {
    try {
        const { screen_id, resolution, user_agent, retailer_id, store_id } = req.body;
        if (!screen_id) return res.status(400).json({ error: 'screen_id required' });

        const screenData = {
            screen_id,
            resolution,
            user_agent,
            status: 'ONLINE',
            last_seen: new Date().toISOString()
        };

        if (retailer_id) screenData.retailer_id = retailer_id;
        if (store_id)    screenData.location_id  = store_id;   // canonical internal field

        const screen = await screenRepository.create(screen_id, screenData);
        res.json(screen);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/screens
 * Admin registration of a new screen from the UI.
 * Mirrors POST /register — accessible without the /register suffix.
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { screen_id, resolution, user_agent, retailer_id, store_id } = req.body;
        if (!screen_id) return res.status(400).json({ error: 'screen_id required' });

        const screenData = {
            screen_id,
            resolution,
            user_agent,
            status: 'ONLINE',
            last_seen: new Date().toISOString()
        };

        if (retailer_id) screenData.retailer_id = retailer_id;
        if (store_id)    screenData.location_id  = store_id;

        const screen = await screenRepository.create(screen_id, screenData);
        res.status(201).json(screen);
    } catch (error) {
        console.error('POST /api/screens failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/screens
 * List screens with role-conditional visibility.
 *
 * Sprint 11 — S11-8:
 *   - techoperator (level 2) and above: full unfiltered list.
 *   - retaileradmin (level 1): list filtered to their own retailer_id from JWT.
 *   - Unauthenticated or insufficient role: 403.
 *
 * The authenticate middleware is called inline so that unauthenticated requests
 * are rejected before any Firestore query is attempted.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        const userLevel = ROLE_HIERARCHY[role] ?? -1;
        const techopLevel = ROLE_HIERARCHY['techoperator'];   // 2
        const retailerLevel = ROLE_HIERARCHY['retaileradmin']; // 1

        if (userLevel >= techopLevel) {
            // techoperator, contentmanager, admin, superadmin — see everything
            const storeId = req.query.store_id || req.query.storeId || req.query.storeid;
            const screens = storeId
                ? await screenRepository.findByLocation(storeId)
                : await screenRepository.findAll();
            return res.json(screens);
        }

        if (userLevel === retailerLevel) {
            // retaileradmin — scoped to their own retailer_id from the auth token
            const retailerId = req.user.linkedentityid || req.user.retailer_id;
            if (!retailerId) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'retaileradmin account has no linked retailer_id'
                });
            }
            const screens = await screenRepository.findAll({
                where: [['retailer_id', '==', retailerId]]
            });
            return res.json(screens);
        }

        // advertiser or unrecognised role — no screen visibility
        return res.status(403).json({
            error: 'Forbidden',
            required: 'techoperator',
            actual: role || 'unauthenticated'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/screens/:id
 * Remove a screen from the network.
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        await screenRepository.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('DELETE /api/screens/:id failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/screens/:id/status
 *
 * Update a screen's operational status with campaign-aware validation.
 * This endpoint is used by the Admin Screen Management UI (Story 2.8-status)
 * to toggle between `active` and `inactive` states.
 *
 * Contract:
 *   - Request body: { status: 'active' | 'inactive' }
 *   - Response 200: updated screen document
 *   - Response 400: invalid payload
 *   - Response 404: screen not found
 *   - Response 409: change rejected due to active/upcoming campaigns
 *       { error: 'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS', message: string }
 */
router.patch('/:id/status', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (!id) {
            return res.status(400).json({ error: 'screenId required' });
        }
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Expected "active" or "inactive".' });
        }

        // When turning a screen inactive, ensure there are no active/upcoming campaigns
        if (status === 'inactive') {
            const hasBlockingCampaigns = await screenRepository.hasActiveOrUpcomingCampaigns(id);
            if (hasBlockingCampaigns) {
                return res.status(409).json({
                    error: 'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS',
                    message:
                        'This screen is part of active or upcoming campaigns. Adjust or cancel those campaigns before setting the screen inactive.'
                });
            }
        }

        const updated = await screenRepository.updateStatus(id, status);
        if (!updated) {
            return res.status(404).json({ error: 'Screen not found' });
        }

        res.json(updated);
    } catch (error) {
        console.error('PATCH /api/screens/:id/status failed:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
