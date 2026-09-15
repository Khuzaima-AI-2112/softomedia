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
