import express from 'express';
import logger from '../utils/logger.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';
import { impressionLimiter } from '../middleware/rateLimiter.js';
import { heartbeatService } from '../services/HeartbeatService.js';
import { playbackService, PlaybackError } from '../services/PlaybackService.js';
import { proofOfPlayService } from '../services/ProofOfPlayService.js';
import { playbackObservationService } from '../services/PlaybackObservationService.js';
import { PresentationEventError } from '../services/PresentationEventValidation.js';
import { isApprovedPlaybackAsset } from '../services/PlaybackEligibility.js';
import { mediaRepository } from '../repositories/index.js';
import { sendMediaContent } from './mediaContent.js';

/**
 * Trusted Screen/device routes. Every route authenticates the calling Player
 * as exactly one registered Screen and acts only on that Screen.
 */
const router = express.Router();

router.use(authenticateDevice);

/** Binds a presentation report to the authenticated Screen, refusing any other Screen. */
function ownPresentation(req, res) {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.screen_id !== undefined && body.screen_id !== req.device.screen_id) {
        res.status(403).json({ error: 'A Screen may only report its own presentations' });
        return null;
    }
    return { ...body, screen_id: req.device.screen_id };
}

function sendPresentationError(res, error, { logMessage, publicMessage }) {
    if (error instanceof PresentationEventError) {
        return res.status(error.status).json({ error: error.message, ...error.details });
    }
    logger.error(logMessage, { error: error.message });
    return res.status(503).json({ error: publicMessage });
}
// GET /api/device/playback — approved Hourly Loop or Holding Slide for this Screen now
router.get('/playback', async (req, res) => {
    try {
        return res.json(await playbackService.getForScreen(req.device.screen_id));
    } catch (error) {
        if (error instanceof PlaybackError) {
            return res.status(error.status).json({ error: error.message });
        }
        logger.error('Device playback failed', { screen_id: req.device.screen_id, error: error.message });
        return res.status(503).json({ error: 'Playback unavailable' });
    }
});

// GET /api/device/media/:assetId — the file of approved playback media; anything else reads as not found
router.get('/media/:assetId', async (req, res) => {
    const asset = await mediaRepository.findById(req.params.assetId);
    if (!isApprovedPlaybackAsset(asset)) return res.status(404).json({ error: 'Media not found' });
    return sendMediaContent(res, asset);
});

// POST /api/device/heartbeat — records this Screen's connectivity
router.post('/heartbeat', async (req, res) => {
    try {
        await heartbeatService.recordHeartbeat(req.device.screen_id);
        return res.json({ status: 'ok', screen_id: req.device.screen_id, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('Device heartbeat failed', { screen_id: req.device.screen_id, error: error.message });
        return res.status(503).json({ error: 'Heartbeat could not be recorded' });
    }
});

/**
 * POST /api/device/proof-of-play — Campaign delivery after presentation starts.
 * 201 { status: 'recorded', event_id } first time; 200 { status: 'duplicate', event_id } on retry.
 */
router.post('/proof-of-play', impressionLimiter, async (req, res) => {
    const presentation = ownPresentation(req, res);
    if (!presentation) return undefined;
    try {
        const result = await proofOfPlayService.record(presentation);
        logger.info('Proof of Play', { type: 'proof_of_play', event_id: result.event.event_id, status: result.status });
        return res.status(result.status === 'recorded' ? 201 : 200)
            .json({ status: result.status, event_id: result.event.event_id });
    } catch (error) {
        return sendPresentationError(res, error, {
            logMessage: 'Proof of Play persistence failed',
            publicMessage: 'Proof of Play could not be persisted',
        });
    }
});

// POST /api/device/playback-observations — fallback and Holding Slide presentations (never delivery)
router.post('/playback-observations', impressionLimiter, async (req, res) => {
    const observation = ownPresentation(req, res);
    if (!observation) return undefined;
    try {
        const result = await playbackObservationService.record(observation);
        return res.status(result.status === 'recorded' ? 201 : 200)
            .json({ status: result.status, event_id: result.observation.event_id });
    } catch (error) {
        return sendPresentationError(res, error, {
            logMessage: 'Playback observation persistence failed',
            publicMessage: 'Playback observation could not be persisted',
        });
    }
});

export default router;
