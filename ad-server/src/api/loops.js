/**
 * Loops API Routes
 * Manages hourly broadcast loops (12 ads × 5 seconds)
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 */

import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { loopRepository, BUSINESS_HOURS } from '../repositories/LoopRepository.js';
import { loopGenerationService } from '../services/LoopGenerationService.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Dedicated Firestore instance for raw aggregation queries in analytics
const db = new Firestore();

/**
 * GET /api/loops
 * List loops with optional filters
 * Query params: date, retailer_id, location_id, status
 */
router.get('/', async (req, res) => {
    try {
        const { date, retailer_id, location_id, status } = req.query;

        let loops;
        if (date) {
            loops = await loopRepository.findByDate(date);
            if (location_id) {
                loops = loops.filter(l => l.location_id === location_id);
            }
        } else {
            const where = [];
            if (retailer_id) where.push(['retailer_id', '==', retailer_id]);
            if (location_id) where.push(['location_id', '==', location_id]);
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
 * GET /api/loops/analytics
 * Aggregate broadcast analytics from the loop_events Firestore collection.
 *
 * Query params:
 *   start_date  {string} YYYY-MM-DD  (default: today)
 *   end_date    {string} YYYY-MM-DD  (default: today)
 *
 * Response shape:
 *   {
 *     impressions_by_day: [{ date, impressions }],
 *     top_screens:        [{ screen_id, impressions }],
 *     fill_rate:          0.94,
 *     paid_vs_house_ratio: 0.72
 *   }
 *
 * Uses Firestore count() aggregation (BaseRepository pattern) to avoid
 * full collection scans on loop_events.
 */
router.get('/analytics', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const startDate = req.query.start_date || today;
        const endDate   = req.query.end_date   || today;

        const eventsCol = db.collection('loop_events');

        // ── 1. Impressions by day ────────────────────────────────────────────
        // Collect each day in the requested range, count events per day.
        const impressions_by_day = [];
        const msPerDay = 86_400_000;
        const start = new Date(startDate);
        const end   = new Date(endDate);

        for (let d = new Date(start); d <= end; d = new Date(d.getTime() + msPerDay)) {
            const dateStr   = d.toISOString().split('T')[0];
            const dayStart  = `${dateStr}T00:00:00.000Z`;
            const dayEnd    = `${dateStr}T23:59:59.999Z`;

            let count = 0;
            try {
                const snap = await eventsCol
                    .where('event_type', '==', 'impression')
                    .where('timestamp', '>=', dayStart)
                    .where('timestamp', '<=', dayEnd)
                    .count()
                    .get();
                count = snap.data().count;
            } catch (_) {
                // Firestore unavailable — count stays 0 (circuit-breaker parity)
            }

            impressions_by_day.push({ date: dateStr, impressions: count });
        }

        // ── 2. Top screens ───────────────────────────────────────────────────
        // Enumerate distinct screen IDs that appear in the range, then rank.
        // We cap at 10 screens to bound the fan-out.
        let top_screens = [];
        try {
            const screenSnap = await eventsCol
                .where('event_type', '==', 'impression')
                .where('timestamp', '>=', `${startDate}T00:00:00.000Z`)
                .where('timestamp', '<=', `${endDate}T23:59:59.999Z`)
                .select('screen_id')
                .limit(5000)      // bounded scan — 5 k max
                .get();

            // Tally in memory (bounded by limit above)
            const tally = {};
            screenSnap.docs.forEach(doc => {
                const sid = doc.data().screen_id;
                if (sid) tally[sid] = (tally[sid] || 0) + 1;
            });

            top_screens = Object.entries(tally)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([screen_id, impressions]) => ({ screen_id, impressions }));
        } catch (_) {
            // Firestore unavailable — return empty list
        }

        // ── 3. Fill rate ─────────────────────────────────────────────────────
        // fill_rate = filled slots / total slots across all loops in range.
        // A slot is "filled" when its status is not AVAILABLE.
        let fill_rate = 0;
        try {
            const loopsSnap = await db.collection('loops')
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();

            let totalSlots  = 0;
            let filledSlots = 0;

            loopsSnap.docs.forEach(doc => {
                const slots = doc.data().slots || [];
                totalSlots  += slots.length;
                filledSlots += slots.filter(s => s.status && s.status !== 'AVAILABLE').length;
            });

            fill_rate = totalSlots > 0
                ? parseFloat((filledSlots / totalSlots).toFixed(4))
                : 0;
        } catch (_) {
            // Firestore unavailable
        }

        // ── 4. Paid vs house ratio ───────────────────────────────────────────
        // paid_vs_house_ratio = paid impressions / (paid + house impressions)
        // loop_events carry an ad_type field: 'paid' | 'house' | 'placeholder'
        let paid_vs_house_ratio = 0;
        try {
            const [paidSnap, houseSnap] = await Promise.all([
                eventsCol
                    .where('event_type', '==', 'impression')
                    .where('ad_type', '==', 'paid')
                    .where('timestamp', '>=', `${startDate}T00:00:00.000Z`)
                    .where('timestamp', '<=', `${endDate}T23:59:59.999Z`)
                    .count()
                    .get(),
                eventsCol
                    .where('event_type', '==', 'impression')
                    .where('ad_type', 'in', ['house', 'placeholder'])
                    .where('timestamp', '>=', `${startDate}T00:00:00.000Z`)
                    .where('timestamp', '<=', `${endDate}T23:59:59.999Z`)
                    .count()
                    .get()
            ]);

            const paid  = paidSnap.data().count;
            const house = houseSnap.data().count;
            const total = paid + house;

            paid_vs_house_ratio = total > 0
                ? parseFloat((paid / total).toFixed(4))
                : 0;
        } catch (_) {
            // Firestore unavailable
        }

        res.json({
            impressions_by_day,
            top_screens,
            fill_rate,
            paid_vs_house_ratio
        });
    } catch (error) {
        logger.error('[Loops API] GET /analytics failed', { error: error.message });
        res.status(500).json({ error: 'Failed to aggregate loop analytics' });
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
 */
router.post('/generate', async (req, res) => {
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
 */
router.patch('/:id/approve', async (req, res) => {
    try {
        const userId = req.body.userId || 'anonymous';
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
 */
router.patch('/:id/slots/:position/reject', async (req, res) => {
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
 */
router.patch('/:id/slots/:position/replace', async (req, res) => {
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
