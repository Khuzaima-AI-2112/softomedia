import express from 'express';
import { heartbeatService, operationalHealthService } from '../services/index.js';
import {
    impressionRepository,
    loopRepository,
    playbackObservationRepository,
    screenRepository,
} from '../repositories/index.js';
import { requireNetworkProofOfPlayView, requireScreenDiagnostics } from '../middleware/requireRole.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/health', requireScreenDiagnostics, async (_req, res) => {
    res.json(await operationalHealthService.check());
});

router.post('/impression', (req, res) => {
    return res.status(410).json({
        error: 'Legacy impression recording has been removed',
        proof_of_play_endpoint: '/api/device/proof-of-play',
    });
});

/**
 * GET /api/monitoring/status
 * Aggregate metrics for Tech Ops dashboard
 */
router.get('/status', requireScreenDiagnostics, async (_req, res) => {
    try {
        await heartbeatService.checkScreenHealth();
        // Nobody approves an Hourly Loop, so a Screen has a schedule once today's loops are generated.
        const targetDate = new Date().toISOString().slice(0, 10);
        const [screens, todaysLoops] = await Promise.all([
            screenRepository.findAll(),
            loopRepository.findAll({ where: [['date', '==', targetDate]] }),
        ]);
        const screenStatuses = screens.map(screen => {
            const scheduleAvailable = todaysLoops.some(loop => (
                loop.location_id === screen.location_id
                || loop.screen_id === screen.id
                || loop.screen_id === 'ALL'
                || loop.screen_ids?.includes(screen.id)
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

router.get('/delivery-report', requireNetworkProofOfPlayView, async (req, res) => {
    try {
        const [loops, proofs, observations] = await Promise.all([
            // Every generated loop plays; nobody approves an Hourly Loop (ADR 0007).
            loopRepository.findAll(),
            impressionRepository.findAll(),
            playbackObservationRepository.findAll(),
        ]);
        const slots = loops.flatMap(loop => loop.slots || []);
        const campaignDelivery = proofs.filter(proof => proof.playback_kind === 'campaign_delivery');

        return res.json({
            allocated_capacity: {
                scope: 'all_hourly_loops',
                hourly_loop_count: loops.length,
                slot_count: slots.length,
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
