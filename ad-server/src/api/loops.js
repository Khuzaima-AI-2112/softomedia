/**
 * Loops API Routes
 * Manages hourly broadcast loops (12 ads × 5 seconds)
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 *
 * Auth: entire router is mounted behind authenticate in api/index.js.
 * Mutation routes (POST /generate, PATCH approve/reject/replace) also
 * carry an inline authenticate guard for defence-in-depth.
 *
 * S13-2 (2026-06-08): Added POST /:loopId/reject and
 * POST /locations/:id/loops/approve-all routes.
 * Both require requireRole('retaileradmin').
 * Existing routes are unchanged.
 *
 * S11-5 (2026-06-17): Added GET /locations/:id/loops.
 * Returns all loops for a specific location scoped to the authenticated
 * retaileradmin. Satisfies #42 guardrail G2 + G3.
 */

import express from 'express';
import { loopRepository, BUSINESS_HOURS, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { loopGenerationService } from '../services/LoopGenerationService.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
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
            if (location_id) loops = loops.filter(l => l.location_id === location_id);
            if (effectiveScreenId) loops = loops.filter(l => l.screen_id === effectiveScreenId);
        } else {
            const where = [];
            if (retailer_id) where.push(['retailer_id', '==', retailer_id]);
            if (location_id) where.push(['location_id', '==', location_id]);
            if (effectiveScreenId) where.push(['screen_id', '==', effectiveScreenId]);
            if (status) where.push(['status', '==', status]);
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
 * GET /api/locations/:locationId/loops
 * List all loops for a specific location.
 * Optional query params: date, status
 * Auth: requireRole('retaileradmin')
 *
 * S11-5 — #42 guardrail G2 (route exists) + G3 (requireRole retaileradmin).
 * Returns { loops, count } consistent with other collection endpoints.
 */
router.get('/locations/:locationId/loops', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        const { locationId } = req.params;
        const { date, status } = req.query;

        const where = [['location_id', '==', locationId]];
        if (date)   where.push(['date',   '==', date]);
        if (status) where.push(['status', '==', status]);

        const loops = await loopRepository.findAll({ where });

        logger.info('[Loops API] GET /locations/:locationId/loops', { locationId, date, status, count: loops.length });
        res.json({ loops, count: loops.length });
    } catch (error) {
        logger.error('[Loops API] GET /locations/:locationId/loops failed', { locationId: req.params.locationId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch loops for location' });
    }
});

/**
 * GET /api/loops/:id
 * Get single loop with slots. Returns screen_count derived from screen_ids.
 */
router.get('/:id', async (req, res) => {
    try {
        const loop = await loopRepository.findById(req.params.id);
        if (!loop) {
            return res.status(404).json({ error: 'Loop not found' });
        }
        res.json({
            ...loop,
            screen_count: loop.screen_ids?.length ?? 1
        });
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

        // Strict 12-Ad Loop Capacity & 60s Limit Validation (MVP Rule 4.1)
        for (const loop of loops) {
            if (!loop.slots || loop.slots.length !== 12) {
                // If any loop violated the exact capacity rule, reject the entire process.
                return res.status(400).json({ error: `Invariant Violation: Loop ${loop.id} does not contain exactly 12 ads.` });
            }
            const totalDuration = loop.slots.reduce((acc, slot) => acc + (slot.duration || 5), 0);
            if (totalDuration !== 60) {
                return res.status(400).json({ error: `Invariant Violation: Loop ${loop.id} duration is ${totalDuration}s instead of the strict 60s.` });
            }
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
 * Approve entire loop.
 * userId is derived exclusively from the authenticated token — no anonymous fallback.
 * Requires authentication.
 */
router.patch('/:id/approve', authenticate, async (req, res) => {
    try {
        const userId = req.user?.uid || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authenticated user required' });
        }

        const updated = await loopRepository.approveLoop(req.params.id, userId);

        logger.info('[Loops API] Loop approved', { loopId: req.params.id, userId });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] PATCH /:id/approve failed', { error: error.message });
        const status = error.message.includes('cannot be approved') ? 400 : 500;
        res.status(status).json({ error: error.message });
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
 * Replace a slot with a new asset.
 * If the loop is currently APPROVED, the repository clones it into a new
 * PENDING_APPROVAL draft. The response will contain the new loop document
 * (possibly with a different id). The client must use the returned object.
 * Body: { assetId }
 * Requires authentication.
 */
router.patch('/:id/slots/:position/replace', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const position = parseInt(req.params.position, 10);
        const { assetId } = req.body;
        const userId = req.user?.uid || null;

        if (!assetId) {
            return res.status(400).json({ error: 'Replacement assetId is required' });
        }

        const updated = await loopRepository.replaceSlot(id, position, assetId, userId);

        logger.info('[Loops API] Slot replaced', { loopId: id, newLoopId: updated.id, position, assetId });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] PATCH /:id/slots/:position/replace failed', { error: error.message });
        res.status(500).json({ error: 'Failed to replace slot' });
    }
});

/**
 * GET /api/loops/pending/:retailerId
 * Get all pending loops for retailer validation.
 *
 * Sprint 10 — sprintWRAPUP item 3: authenticate + requireRole('retaileradmin')
 * added. This endpoint exposes unapproved campaign content — it must not be
 * publicly readable.
 */
router.get('/pending/:retailerId', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        const loops = await loopRepository.findPendingByRetailer(req.params.retailerId);
        res.json({ loops, count: loops.length });
    } catch (error) {
        logger.error('[Loops API] GET /pending/:retailerId failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch pending loops' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// S13-2 routes — added 2026-06-08
// Both routes appended after all existing handlers. No existing route modified.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/loops/:loopId/reject
 * Reject an entire loop (loop-level rejection, distinct from slot-level PATCH above).
 * Sets loops.status to LOOP_STATUS.REJECTED.
 * Body: { reason }
 * Auth: requireRole('retaileradmin')
 *
 * S13-2 AC-1, AC-3, AC-5
 */
router.post('/:loopId/reject', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        const { loopId } = req.params;
        const { reason } = req.body;

        const loop = await loopRepository.findById(loopId);
        if (!loop) {
            return res.status(404).json({ error: 'Loop not found' });
        }

        const updated = await loopRepository.update(loopId, {
            status: LOOP_STATUS.REJECTED,
            rejection_reason: reason || null,
            rejected_at: new Date().toISOString(),
            rejected_by: req.user?.uid || null,
        });

        logger.info('[Loops API] Loop rejected', { loopId, reason, userId: req.user?.uid });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] POST /:loopId/reject failed', { loopId: req.params.loopId, error: error.message });
        res.status(500).json({ error: 'Failed to reject loop' });
    }
});

/**
 * POST /api/locations/:locationId/loops/approve-all
 * Bulk-approve all pending_approval loops for a given location.
 * Optionally filtered by date (body: { date? }).
 * Returns { approved: N } where N is the count of newly-approved loops.
 * Auth: requireRole('retaileradmin')
 *
 * Mount note: this router handles both /api/loops/* and /api/locations/* paths.
 * For /api/locations/:locationId/loops/approve-all to resolve, the Express app
 * must either:
 *   (a) mount this router at both /api/loops and /api/locations, OR
 *   (b) register this specific route in a dedicated locations router.
 * Confirm mount point per sprint13.md S13-2 AC-2 before marking story Done.
 *
 * S13-2 AC-2, AC-3
 */
router.post('/locations/:locationId/loops/approve-all', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        const { locationId } = req.params;
        const { date } = req.body;

        const where = [
            ['location_id', '==', locationId],
            ['status', '==', LOOP_STATUS.PENDING_APPROVAL],
        ];
        if (date) where.push(['date', '==', date]);

        const pendingLoops = await loopRepository.findAll({ where });

        if (pendingLoops.length === 0) {
            return res.json({ approved: 0, message: 'No pending loops found for this location' });
        }

        const userId = req.user?.uid || null;
        const approvalPromises = pendingLoops.map(loop =>
            loopRepository.update(loop.id, {
                status: LOOP_STATUS.APPROVED,
                approved_at: new Date().toISOString(),
                approved_by: userId,
            })
        );
        await Promise.all(approvalPromises);

        logger.info('[Loops API] Bulk approve-all', { locationId, date, count: pendingLoops.length, userId });
        res.json({ approved: pendingLoops.length });
    } catch (error) {
        logger.error('[Loops API] POST /locations/:locationId/loops/approve-all failed', { locationId: req.params.locationId, error: error.message });
        res.status(500).json({ error: 'Failed to bulk approve loops' });
    }
});

export default router;
