import express from 'express';
import { heartbeatService } from '../services/index.js';
import { impressionRepository, locationRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

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
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/monitoring/impression
 * Logs Proof-of-Play events
 */
router.post('/impression', async (req, res) => {
    try {
        const { screenId, campaignId, mediaId, duration } = req.body;

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
            duration: duration || 5
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
router.get('/status', async (req, res) => {
    try {
        const { screenRepository } = await import('../repositories/index.js');
        const screens = await screenRepository.findAll();

        const stats = {
            total: screens.length,
            online: screens.filter(s => s.status === 'ONLINE').length,
            offline: screens.filter(s => s.status === 'OFFLINE').length,
            screens: screens.map(s => ({
                id: s.id,
                status: s.status,
                last_seen: s.last_seen
            }))
        };

        res.json(stats);
    } catch (error) {
        logger.error('Status API error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
