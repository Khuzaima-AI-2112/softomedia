import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { impressionLimiter } from '../middleware/rateLimiter.js';

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
 * Helper Sink for Local Dev/Testing (simulates GCS Bucket)
 */
router.put('/sink/*', (req, res) => {
    logger.info('Received Batch Telemetry Upload (Sink)', {
        path: req.params[0],
        size: req.headers['content-length']
    });
    res.status(200).send('OK');
});

/**
 * POST /api/telemetry/impression
 * Receives a single real-time impression event from the Player.
 *
 * Sprint 9 — Task 9.3: impressionLimiter applied (100 req/min per IP).
 * The limiter is scoped to this verb only; upload-url, sink, and error
 * routes are unaffected.
 *
 * Body:
 *   - screen_id    {string} REQUIRED
 *   - campaign_id  {string} REQUIRED
 *   - asset_id     {string} optional
 *   - loop_id      {string} optional
 *   - played_at    {string} optional ISO 8601; defaults to server time
 *
 * Returns 201 { status: 'recorded', impression_id } on success.
 * Returns 400 if screen_id or campaign_id are missing.
 * Returns 429 with Retry-After header when rate limit exceeded.
 *
 * Phase 2 (TODO): persist to impressions Firestore collection and increment
 *   campaign play_count via campaignService.
 */
router.post('/impression', impressionLimiter, (req, res) => {
    const { screen_id, campaign_id, asset_id, loop_id, played_at } = req.body;

    if (!screen_id || !campaign_id) {
        return res.status(400).json({
            error: 'screen_id and campaign_id are required'
        });
    }

    const impression_id = uuidv4();
    const recorded_at = played_at || new Date().toISOString();

    logger.info('Impression', {
        type: 'impression',
        impression_id,
        screen_id,
        campaign_id,
        asset_id:  asset_id  || null,
        loop_id:   loop_id   || null,
        played_at: recorded_at,
    });

    res.status(201).json({ status: 'recorded', impression_id });
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
