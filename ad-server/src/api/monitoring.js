import express from 'express';
import { heartbeatService, operationalHealthService } from '../services/index.js';
import { impressionRepository, locationRepository, loopRepository, screenRepository } from '../repositories/index.js';
import { LOOP_STATUS } from '../repositories/LoopRepository.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../constants/roles.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/health', requireRole(ROLES.TECHOPERATOR), async (_req, res) => {
    res.json(await operationalHealthService.check());
});

/**
 * POST /api/monitoring/heartbeat
 * Receives health signal from player screens
 */
router.post('/heartbeat', async (req, res) => {
    try {
        const { screenId } = req.body;
        if (!screenId) return res.status(400).json({ error: 'screenId required' });

        await heartbeatService.recordHeartbeat(screenId);
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('Heartbeat API error', { error: error.message });
        if (error.message === 'Screen not found') {
            return res.status(404).json({ error: 'Screen not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/monitoring/impression
 * Logs Proof-of-Play events
 */
router.post('/impression', async (req, res) => {
    try {
        const { screenId, campaignId, mediaId, duration, source, playlistId } = req.body;

        if (!screenId || !campaignId) {
            return res.status(400).json({ error: 'screenId and campaignId required' });
        }

        // Identify location for analytics clustering
        const screens = await locationRepository.findAll({
            where: [['screen_ids', 'array-contains', screenId]]
        });
        const locationId = screens[0]?.id || 'unknown';

        await impressionRepository.logImpression({
            screen_id: screenId,
            campaign_id: campaignId,
            media_id: mediaId,
            location_id: locationId,
            duration: duration || 5,
            source,
            playlistId
        });

        res.status(201).json({ status: 'logged' });
    } catch (error) {
        logger.error('Impression API error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/monitoring/status
 * Aggregate metrics for Tech Ops dashboard
 */
router.get('/status', requireRole(ROLES.TECHOPERATOR), async (_req, res) => {
    try {
        await heartbeatService.checkScreenHealth();
        const [screens, approvedLoops] = await Promise.all([
            screenRepository.findAll(),
            loopRepository.findAll({
                where: [['status', '==', LOOP_STATUS.APPROVED]],
            }),
        ]);
        const targetDate = new Date().toISOString().slice(0, 10);
        const screenStatuses = screens.map(screen => {
            const scheduleAvailable = approvedLoops.some(loop => (
                loop.date === targetDate
                && (
                    loop.location_id === screen.location_id
                    || loop.screen_id === screen.id
                    || loop.screen_id === 'ALL'
                    || loop.screen_ids?.includes(screen.id)
                )
            ));
            return {
                id: screen.id,
                screen_id: screen.screen_id || screen.id,
                retailer_id: screen.retailer_id || null,
                store_id: screen.store_id || null,
                location_id: screen.location_id || null,
                connectivity: screen.status === 'ONLINE' ? 'online' : 'offline',
                status: screen.status,
                last_seen: screen.last_seen || null,
                schedule: {
                    state: scheduleAvailable ? 'available' : 'unavailable',
                    approved: scheduleAvailable,
                },
            };
        });

        const stats = {
            total: screenStatuses.length,
            online: screenStatuses.filter(screen => screen.connectivity === 'online').length,
            offline: screenStatuses.filter(screen => screen.connectivity === 'offline').length,
            screens: screenStatuses,
        };

        res.json(stats);
    } catch (error) {
        logger.error('Status API error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
