import express from 'express';
import { screenRepository, adRepository } from '../repositories/index.js';

const router = express.Router();

const START_TIME = new Date();

/**
 * GET /api/health/v2
 * Advanced diagnostics for observability
 */
router.get('/v2', async (req, res) => {
    try {
        const uptime = Math.floor((new Date() - START_TIME) / 1000);

        // Simple integrity check: ensure we have data in key collections
        const screenCount = await screenRepository.count();
        const adCount = await adRepository.count();

        res.json({
            status: 'healthy',
            version: '1.1.0-mvp',
            uptime: `${uptime}s`,
            timestamp: new Date().toISOString(),
            diagnostics: {
                memory: process.memoryUsage(),
                persistence: {
                    mode: screenRepository.db ? 'firestore' : 'in-memory-fallback',
                    screens_detected: screenCount,
                    ads_active: adCount
                }
            },
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(503).json({
            status: 'degraded',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;
