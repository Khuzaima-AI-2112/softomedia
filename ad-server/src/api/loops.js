/**
 * Loops API Routes
 * Manages hourly broadcast loops (12 ads × 5 seconds)
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 *
 * Auth: entire router is mounted behind authenticate in api/index.js.
 * Mutation routes (POST /generate, PATCH approve/reject/replace) also
 * carry an inline authenticate guard for defence-in-depth.
 */

import express from 'express';
import { loopRepository, BUSINESS_HOURS } from '../repositories/LoopRepository.js';
import { loopGenerationService } from '../services/LoopGenerationService.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/loops
 * List loops with optional filters
 * Query params: date, retailer_id, location_id, screen_id, screenid, status
 */
router.get('/', async (req, res) => {
    try {
        const { date, retailer_id, location_id, screen_id, screenid, status } = req.query;

        // Normalise — accept both ?screen_id= and ?screenid= from any caller
        const effectiveScreenId = screen_id || screenid || null;

        let loops;
        if (date) {
            loops = await loopRepository.findByDate(date);
            if (location_id)       loops = loops.filter(l => l.location_id === location_id);
            if (effectiveScreenId) loops = loops.filter(l => l.screen_id  === effectiveScreenId);
        } else {
            const where = [];
            if (retailer_id)      where.push(['retailer_id', '==', retailer_id]);
            if (location_id)      where.push(['location_id', '==', location_id]);
            if (effectiveScreenId) where.push(['screen_id',  '==', effectiveScreenId]);
            if (status)           where.push(['status',      '==', status]);
            loops = await loopRepository.findAll({ where });
        }

        // Determine dynamic business hours for UI
        let startHour = 8;
        let endHour = 22;
        let isClosed = false;

        if (date && location_id) {
            const effective = await BusinessHoursService.getEffectiveHours(location_id, date);
            if (effective.is_closed) {
                isClosed = true;
            } else {
                startHour = parseInt(effective.open_time.split(':')[0], 10);
                endHour = parseInt(effective.close_time.split(':')[0], 10);
                if (endHour === 0) endHour = 24;
            }
        }

        res.json({
            loops,
            business_hours: {
                start: startHour,
                end: endHour,
                is_closed: isClosed,
                total_loops: isClosed ? 0 : (endHour - startHour)
            }
        });
    } catch (error) {
        logger.error('[Loops API] GET / failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch loops' });
    }
});

/**
 * GET /api/loops/:id
 * Get single loop with slots
 */
router.get('/:id', async (req, res) => {
    try {
        const loop = await loopRepository.findById(req.params.id);
        if (!loop) {
            return res.status(404).json({ error: 'Loop not found' });
        }
        res.json(loop);
    } catch (error) {
        logger.error('[Loops API] GET /:id failed', { id: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to fetch loop' });
    }
});

/**
 * POST /api/loops/generate
 * Trigger D-1 loop generation
 * Body: { targetDate, retailerId, locationId }
 * Requires authentication (defence-in-depth — router is also behind authenticate).
 */
router.post('/generate', authenticate, async (req, res) => {
    try {
        const { targetDate, retailerId, locationId, mock } = req.body;

        if (!targetDate || !retailerId || !locationId) {
            return res.status(400).json({
                error: 'Missing required fields: targetDate, retailerId, locationId'
            });
        }

        logger.info('[Loops API] Generating loops', { targetDate, retailerId, locationId, mock });

        let loops;
        if (mock) {
            loops = await loopGenerationService.generateMockLoops(targetDate, retailerId, locationId);
        } else {
            loops = await loopGenerationService.generateDailyLoops(targetDate, retailerId, locationId);
        }

        res.status(201).json({
            message: `Generated ${loops.length} loops for ${targetDate}`,
            loops,
            business_hours: {
                start: BUSINESS_HOURS.START,
                end: BUSINESS_HOURS.END
            }
        });
    } catch (error) {
        logger.error('[Loops API] POST /generate failed', { error: error.message });
        res.status(500).json({ error: 'Failed to generate loops' });
    }
});

/**
 * PATCH /api/loops/:id/approve
 * Approve entire loop (retailer action)
 * Requires authentication.
 */
router.patch('/:id/approve', authenticate, async (req, res) => {
    try {
        const userId = req.body.userId || req.user?.uid || 'anonymous';
        const updated = await loopRepository.approveLoop(req.params.id, userId);

        logger.info('[Loops API] Loop approved', { loopId: req.params.id, userId });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] PATCH /:id/approve failed', { error: error.message });
        res.status(500).json({ error: 'Failed to approve loop' });
    }
});

/**
 * PATCH /api/loops/:id/slots/:position/reject
 * Reject a single slot
 * Body: { reason }
 * Requires authentication.
 */
router.patch('/:id/slots/:position/reject', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const position = parseInt(req.params.position, 10);
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const updated = await loopRepository.rejectSlot(id, position, reason);

        logger.info('[Loops API] Slot rejected', { loopId: id, position, reason });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] PATCH /:id/slots/:position/reject failed', { error: error.message });
        res.status(500).json({ error: 'Failed to reject slot' });
    }
});

/**
 * PATCH /api/loops/:id/slots/:position/replace
 * Replace a rejected slot with new asset
 * Body: { assetId }
 * Requires authentication.
 */
router.patch('/:id/slots/:position/replace', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const position = parseInt(req.params.position, 10);
        const { assetId } = req.body;

        if (!assetId) {
            return res.status(400).json({ error: 'Replacement assetId is required' });
        }

        const updated = await loopRepository.replaceSlot(id, position, assetId);

        logger.info('[Loops API] Slot replaced', { loopId: id, position, assetId });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] PATCH /:id/slots/:position/replace failed', { error: error.message });
        res.status(500).json({ error: 'Failed to replace slot' });
    }
});

/**
 * GET /api/loops/pending/:retailerId
 * Get all pending loops for retailer validation
 */
router.get('/pending/:retailerId', async (req, res) => {
    try {
        const loops = await loopRepository.findPendingByRetailer(req.params.retailerId);
        res.json({ loops, count: loops.length });
    } catch (error) {
        logger.error('[Loops API] GET /pending/:retailerId failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch pending loops' });
    }
});

export default router;
