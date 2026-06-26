import express from 'express';
import { impressionRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/loops', authenticate, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date query parameter is required' });
        }

        const impressions = await impressionRepository.findAll();
        
        // Group hours 8 to 22 (business hours)
        const hoursMap = {};
        for (let h = 8; h < 22; h++) {
            hoursMap[h] = {
                hour: h,
                loopCompletions: 0,
                integrityScore: 100.0,
                status: 'DELIVERED'
            };
        }

        for (const imp of impressions) {
            const playedAt = imp.played_at || imp.timestamp;
            if (playedAt && playedAt.startsWith(date)) {
                try {
                    const playedDate = new Date(playedAt);
                    let hour = playedDate.getHours();
                    
                    // SRE Fix: Prevent data loss for timezone-shifted or out-of-hours impressions
                    // Clamp to the visible dashboard hours (8 to 21)
                    if (hour < 8) hour = 8;
                    if (hour > 21) hour = 21;
                    
                    if (hoursMap[hour] !== undefined) {
                        hoursMap[hour].loopCompletions += 1;
                    }
                } catch (e) {
                    // ignore parse error
                }
            }
        }

        res.json(Object.values(hoursMap));
    } catch (error) {
        logger.error('[Analytics API] GET /loops failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch loop analytics' });
    }
});

export default router;
