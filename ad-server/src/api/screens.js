import express from 'express';
import { screenRepository, impressionRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, ROLE_HIERARCHY, normalizeRole } from '../middleware/requireRole.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

/**
 * Helper: maps a CircuitBreaker OPEN error to a 503 response.
 * Returns true if handled, false otherwise.
 */
function handleCircuitBreakerError(error, res) {
    if (error.code === 'CIRCUIT_BREAKER_OPEN') {
        const retryAfter = Math.ceil((error.retryAfterMs ?? 30000) / 1000);
        res.set('Retry-After', String(retryAfter));
        res.status(503).json({
            error: 'Database temporarily unavailable. Please try again shortly.',
            retryAfterSeconds: retryAfter
        });
        return true;
    }
    return false;
}

/**
 * POST /api/screens/register
 * Device self-registration — authenticate only, no role guard.
 * Physical screens have no user role; any authenticated caller may register.
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
        if (store_id) screenData.location_id = store_id;   // canonical internal field

        const screen = await screenRepository.create(screen_id, screenData);
        res.json(screen);
    } catch (error) {
        if (error.code === 6 || (error.message && error.message.includes('ALREADY_EXISTS'))) {
            try {
                const existingScreen = await screenRepository.findById(req.body.screen_id);
                // Device rebooted — update its last_seen and resolution
                await screenRepository.update(req.body.screen_id, {
                    last_seen: new Date().toISOString(),
                    resolution: req.body.resolution,
                    status: 'ONLINE'
                });
                return res.status(200).json(existingScreen);
            } catch (findErr) {
                console.error('Failed to update existing screen during register:', findErr);
            }
        }
        if (handleCircuitBreakerError(error, res)) return;
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/screens
 * Admin UI registration of a new screen.
 * Requires admin (level 4) or above — intentionally stricter than /register
 * because this path is called from the management UI, not from a device.
 *
 * fix: authenticate-only guard was insufficient — any authenticated user
 *   including advertiser (level 0) could create screens. requireRole('admin')
 *   added to match the admin-only UI that calls this endpoint.
 */
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
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
        if (store_id) screenData.location_id = store_id;

        const screen = await screenRepository.create(screen_id, screenData);
        res.status(201).json(screen);
    } catch (error) {
        if (error.code === 6 || (error.message && error.message.includes('ALREADY_EXISTS'))) {
            try {
                const docId = req.body.screen_id || req.body.id || req.body.name;
                const existingScreen = await screenRepository.findById(docId);
                return res.status(200).json(existingScreen);
            } catch (findErr) {
                // If it fails to fetch, fall through to error logging
                console.error('Failed to fetch existing screen during idempotent creation:', findErr);
            }
        }
        console.error('POST /api/screens failed:', error);
        if (handleCircuitBreakerError(error, res)) return;
        res.status(500).json({ error: 'Failed to register screen' });
    }
});

/**
 * GET /api/screens
 * List screens with role-conditional visibility.
 *
 * Sprint 11 — S11-8:
 *   - techoperator (level 2) and above: full unfiltered list.
 *   - retaileradmin (level 1): list filtered to their own retailer_id from JWT.
 *   - brand (level 1): denied; Brands use the sanitized Bookable Inventory API.
 *   - Unauthenticated or insufficient role: 403.
 *
 * fix: brand role was missing from ROLE_HIERARCHY entirely, causing 403 on
 *      GET /api/screens during campaign wizard load for all brand users.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        const userLevel = ROLE_HIERARCHY[role] ?? -1;
        const techopLevel = ROLE_HIERARCHY[ROLES.TECHOPERATOR];    // 2
        const retailerLevel = ROLE_HIERARCHY[ROLES.RETAILERADMIN]; // 1

        if (userLevel >= techopLevel) {
            // techoperator, contentmanager, admin, superadmin — see everything
            const storeId = req.query.store_id || req.query.storeId || req.query.storeid;
            const screens = storeId
                ? await screenRepository.findByLocation(storeId)
                : await screenRepository.findAll();
            return res.json(screens);
        }

        if (userLevel === retailerLevel && role === ROLES.RETAILERADMIN) {
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
            required: ROLES.TECHOPERATOR,
            actual: role || 'unauthenticated'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/screens/:id/logs
 * Return recent activity log entries for a single screen.
 *
 * Sprint 13 — S13-1: wires the TechOpsDashboard terminal log viewer.
 *
 * Implementation: queries the impressions collection filtered by screen_id,
 * ordered newest-first, limited to 100 entries. This provides a meaningful
 * activity trace (what the screen last played and when) until a dedicated
 * device-side log streaming endpoint is available.
 *
 * Auth: authenticate + techoperator (level 2) or above.
 *
 * Returns:
 *   200  { logs: Array<ImpressionRecord> }
 *   404  { error: 'Screen not found' }  when screen_id does not exist
 *   403  insufficient role
 */
router.get('/:id/logs', authenticate, requireRole('techoperator'), async (req, res) => {
    try {
        const screenId = req.params.id;

        // Verify the screen exists before returning logs
        const screen = await screenRepository.findById(screenId);
        if (!screen) {
            return res.status(404).json({ error: 'Screen not found', screen_id: screenId });
        }

        const logs = await impressionRepository.findAll({
            where: [['screen_id', '==', screenId]],
            orderBy: ['timestamp', 'desc'],
            limit: 100,
        });

        return res.json({ screen_id: screenId, logs });
    } catch (error) {
        console.error('GET /api/screens/:id/logs failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/screens/:id
 * Remove a screen from the network.
 *
 * fix: authenticate-only guard was insufficient — any authenticated user
 *   could delete any screen. requireRole('techoperator') added as the
 *   minimum sensible level for destructive network operations.
 */
router.delete('/:id', authenticate, requireRole('techoperator'), async (req, res) => {
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
router.patch('/:id/status', authenticate,
    async (req, res) => {
        try {
            const { status } = req.body;
            if (!status || !['active', 'inactive'].includes(status)) {
                return res.status(400).json({
                    error: 'status must be \'active\' or \'inactive\''
                });
            }

            const screen = await screenRepository.findById(req.params.id);
            if (!screen) {
                return res.status(404).json({ error: 'Screen not found' });
            }

            // Block deactivation when campaigns are live/upcoming
            if (status === 'inactive') {
                const hasBlocking = await screenRepository.hasActiveOrUpcomingCampaigns(req.params.id);
                if (hasBlocking) {
                    return res.status(409).json({
                        error: 'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS',
                        message: 'Screen cannot be deactivated while active or upcoming campaigns are assigned to it.'
                    });
                }
            }

            const updated = await screenRepository.updateStatus(req.params.id, status);
            return res.json(updated);
        } catch (error) {
            console.error('PATCH /api/screens/:id/status failed:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * GET /api/screens/:id/playback-loop
 * Devices poll this public endpoint for playback selected from the Screen's
 * persisted assignment and the current Store-local date/hour. The service
 * returns either an approved schedule or an explicit Holding Slide state.
 */
import { playbackService, PlaybackError } from '../services/PlaybackService.js';

router.get('/:id/playback-loop', async (req, res) => {
    try {
        const playback = await playbackService.getForScreen(req.params.id);
        return res.status(200).json(playback);
    } catch (error) {
        if (error instanceof PlaybackError) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error('GET /api/screens/:id/playback-loop failed:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
