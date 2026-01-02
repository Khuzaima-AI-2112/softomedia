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

        // Gather breaker stats from primary repositories
        const breakers = [
            screenRepository.breaker.getHealth(),
            adRepository.breaker.getHealth()
        ];

        const isAnyBreakerOpen = breakers.some(b => b.state === 'OPEN');

        res.json({
            status: isAnyBreakerOpen ? 'degraded' : 'healthy',
            version: '1.2.0-resilient',
            uptime: `${uptime}s`,
            timestamp: new Date().toISOString(),
            diagnostics: {
                memory: process.memoryUsage(),
                persistence: {
                    mode: screenRepository.db ? 'firestore' : 'mock',
                    breakers
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
