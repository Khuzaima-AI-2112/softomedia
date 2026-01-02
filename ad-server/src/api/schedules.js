import express from 'express';
import { campaignRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/schedules
 * Returns mock schedules for UI testing
 */
router.get('/', (req, res) => {
    res.json([
        {
            id: 'sch_prime_time',
            name: 'Prime Time Loop',
            type: 'daily',
            active: true,
            rules: ['07:00 PM', '08:00 PM']
        },
        {
            id: 'sch_morning',
            name: 'Morning Rush',
            type: 'daily',
            active: true,
            rules: ['08:00 AM', '09:00 AM']
        }
    ]);
});

export default router;
