import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { impressionLimiter } from '../middleware/rateLimiter.js';
import { proofOfPlayService, ProofOfPlayError } from '../services/ProofOfPlayService.js';
import { playbackObservationService } from '../services/PlaybackObservationService.js';
import { PresentationEventError } from '../services/PresentationEventValidation.js';
import { authenticate } from '../middleware/auth.js';
import { requireProofOfPlaySubmission } from '../middleware/requireRole.js';

const router = express.Router();

// GCP Storage (or Mock)
// In production: import { Storage } from '@google-cloud/storage';
// const storage = new Storage();
// const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * GET /api/telemetry/upload-url
 * Returns a signed URL for the device to upload its crash logs or impression batch.
 */
router.get('/upload-url', async (req, res) => {
    try {
        const timestamp = Date.now();
        const batchId = uuidv4();
        const filename = `telemetry/${timestamp}_${batchId}.json`;

        // Mock Implementation for MVP/Local
        const mockUrl = `${process.env.API_URL || 'http://localhost:8080'}/api/telemetry/sink/${filename}`;

        logger.info('Generated Batch Upload URL', { filename, mockUrl });

        res.json({
            uploadUrl: mockUrl,
            batchId,
            expiresAt: Date.now() + 300000
        });

    } catch (error) {
        logger.error('Failed to generate upload URL', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/telemetry/sink/*
 * Helper Sink for Local Dev/Testing (simulates GCS Bucket).
 *
 * Sprint 11 — S11-3: guarded behind NODE_ENV !== 'production' so this
 * unauthenticated write endpoint is never reachable in production.
 * In production, requests to this path fall through to a 404.
 */
if (process.env.NODE_ENV !== 'production') {
    router.put('/sink/*', (req, res) => {
        logger.info('Received Batch Telemetry Upload (Sink)', {
            path: req.params[0],
            size: req.headers['content-length']
        });
        res.status(200).send('OK');
    });
}

/**
 * POST /api/telemetry/impression
 * Receives a single real-time impression event from the Player.
 *
 * Sprint 9 — Task 9.3: impressionLimiter applied (100 req/min per IP).
 * Issue #11: persist a caller-identified Proof of Play and increment the
 * Campaign delivery counter in one atomic transaction.
 *
 * Body:
 *   - event_id, screen_id, location_id, loop_id, campaign_id, asset_id
 *   - slot_position, presentation_started_at, intended_duration_seconds
 *
 * Returns 201 { status: 'recorded', event_id } on first persistence.
 * Returns 200 { status: 'duplicate', event_id } for an idempotent retry.
 * Returns 429 with Retry-After header when rate limit exceeded.
 */
router.post('/impression', authenticate, requireProofOfPlaySubmission, impressionLimiter, async (req, res) => {
    try {
        const result = await proofOfPlayService.record(req.body);
        logger.info('Proof of Play', {
            type: 'proof_of_play',
            event_id: result.event.event_id,
            status: result.status,
        });
        const response = { status: result.status, event_id: result.event.event_id };
        return res.status(result.status === 'recorded' ? 201 : 200).json(response);
    } catch (error) {
        if (error instanceof ProofOfPlayError) {
            return res.status(error.status).json({ error: error.message, ...error.details });
        }
        logger.error('Proof of Play persistence failed', { error: error.message });
        return res.status(503).json({ error: 'Proof of Play could not be persisted' });
    }
});

router.post('/playback-observation', authenticate, requireProofOfPlaySubmission, async (req, res) => {
    try {
        const result = await playbackObservationService.record(req.body);
        return res.status(result.status === 'recorded' ? 201 : 200).json({
            status: result.status,
            event_id: result.observation.event_id,
        });
    } catch (error) {
        if (error instanceof PresentationEventError) {
            return res.status(error.status).json({ error: error.message, ...error.details });
        }
        logger.error('Playback observation persistence failed', { error: error.message });
        return res.status(503).json({ error: 'Playback observation could not be persisted' });
    }
});

/**
 * POST /api/telemetry/error
 * Receives client-side exception reports (stack traces, component stacks)
 */
router.post('/error', (req, res) => {
    const { message, stack, componentStack, url, userAgent } = req.body;

    logger.error('Client-Side Application Error', {
        type: 'client_error',
        message,
        stack,
        component_stack: componentStack,
        url: url || 'unknown',
        user_agent: userAgent || req.get('user-agent'),
        ip: req.ip
    });

    res.status(200).json({ status: 'logged' });
});

export default router;
