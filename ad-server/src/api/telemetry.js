import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

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
        // 1. Auth Check (Implicit via middleware, or specific check)
        // const authHeader = req.headers.authorization; 

        const timestamp = Date.now();
        const batchId = uuidv4();
        const filename = `telemetry/${timestamp}_${batchId}.json`;

        // 2. Generate Signed URL
        // Real Implementation:
        /*
        const [url] = await bucket.file(filename).getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 5 * 60 * 1000, // 5 minutes
            contentType: 'application/json',
        });
        */

        // Mock Implementation for MVP/Local
        // We point the client to a local "sink" endpoint that accepts the PUT
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
    // In a real sink, we might save this file to disk for inspection
    res.status(200).send('OK');
});

/**
 * POST /api/telemetry/impression
 * Receives a single real-time impression event from the Player.
 *
 * Body:
 *   - screen_id    {string} REQUIRED — the screen that played the ad
 *   - campaign_id  {string} REQUIRED — the campaign being played
 *   - asset_id     {string} optional — specific creative asset
 *   - loop_id      {string} optional — the loop this slot belongs to
 *   - played_at    {string} optional — ISO 8601 timestamp; defaults to server time
 *
 * Returns 201 { status: 'recorded', impression_id } on success.
 * Returns 400 if screen_id or campaign_id are missing.
 *
 * Phase 1: writes to structured logger (Winston).
 * Phase 2 (TODO): persist to impressions Firestore collection and increment
 *   campaign play_count via campaignService.
 */
router.post('/impression', (req, res) => {
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
