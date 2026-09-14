import express from 'express';
import { heartbeatService } from '../services/index.js';
import { impressionRepository, loopRepository, playbackObservationRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';
import { requireNetworkProofOfPlayView } from '../middleware/requireRole.js';

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

router.post('/impression', (req, res) => {
    return res.status(410).json({
        error: 'Legacy impression recording has been removed',
        proof_of_play_endpoint: '/api/telemetry/impression',
    });
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

router.get('/delivery-report', requireNetworkProofOfPlayView, async (req, res) => {
    try {
        const [loops, proofs, observations] = await Promise.all([
            loopRepository.findAll({ where: [['status', '==', 'approved']] }),
            impressionRepository.findAll(),
            playbackObservationRepository.findAll(),
        ]);
        const slots = loops.flatMap(loop => loop.slots || []);
        const campaignDelivery = proofs.filter(proof => proof.playback_kind === 'campaign_delivery');

        return res.json({
            allocated_capacity: {
                scope: 'all_approved_hourly_loops',
                approved_hourly_loop_count: loops.length,
                approved_slot_count: slots.length,
            },
            campaign_delivery: campaignDelivery.length,
            fallback_playback: observations.filter(item => item.presentation_type === 'fallback').length,
            holding_slide_playback: observations.filter(item => item.presentation_type === 'holding_slide').length,
            recent_campaign_delivery: campaignDelivery.slice(0, 20),
            generated_at: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Delivery report failed', { error: error.message });
        return res.status(500).json({ error: 'Delivery report unavailable' });
    }
});

export default router;
