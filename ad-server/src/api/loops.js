/**
 * Loops API Routes
 * Manages hourly broadcast loops (12 ads × 5 seconds)
 * Business Hours: 8:00 AM - 10:00 PM (14 loops per day)
 *
 * Auth: entire router is mounted behind authenticate in api/index.js.
 * Mutation routes (POST /generate, PATCH replace) also carry an inline
 * authenticate guard for defence-in-depth.
 *
 * Nobody approves an Hourly Loop: a Screen plays the generated loop, and each
 * Paid Slot plays only when its Creative has both approvals (ADR 0007). The
 * Retailer Administrator can still preview the loop (#21).
 *
 * Route ordering: all static-segment routes are hoisted above wildcard /:id routes.
 */

import express from 'express';
import { loopRepository } from '../repositories/LoopRepository.js';
import { loopGenerationService } from '../services/LoopGenerationService.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { SLOTS_PER_LOOP } from '../services/SlotInventory.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, requirePermission } from '../middleware/requireRole.js';
import { canManageRetailer, denyStoreAccess, retailerIdFor } from '../middleware/storeManagement.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import logger from '../utils/logger.js';

const router = express.Router();

async function findAuthorizedLoop(req, res, allowedRoles) {
    if (req.user && !allowedRoles.includes(normalizeRole(req.user.role))) {
        denyStoreAccess(res);
        return null;
    }
    const loop = await loopRepository.findById(req.params.id);
    if (!loop) {
        res.status(404).json({ error: 'Loop not found' });
        return null;
    }
    if (req.user && !canManageRetailer(req.user, loop.retailer_id)) {
        denyStoreAccess(res);
        return null;
    }
    return loop;
}

/** The Slot position in the URL as a whole number inside the Hourly Loop, or null. */
function slotPositionFrom(param) {
    if (!/^\d+$/.test(param)) return null;
    const position = Number(param);
    return position < SLOTS_PER_LOOP ? position : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET routes — static-segment paths MUST precede /:id wildcard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/loops
 * List loops with optional filters
 * Query params: date, retailer_id, store_id, location_id, screen_id, screenid
 */
router.get('/', async (req, res) => {
    try {
        const { date, retailer_id, store_id, location_id, screen_id, screenid } = req.query;

        // Normalise — accept both ?screen_id= and ?screenid= from any caller
        const effectiveScreenId = screen_id || screenid || null;

        let loops;
        const role = normalizeRole(req.user?.role);
        const ownRetailerId = retailerIdFor(req.user);
        if (req.user && ![ROLES.RETAILERADMIN, ROLES.ADMIN, ROLES.SUPERADMIN].includes(role)) {
            return denyStoreAccess(res);
        }
        if (role === ROLES.RETAILERADMIN && retailer_id && retailer_id !== ownRetailerId) {
            return denyStoreAccess(res);
        }
        if (store_id) {
            const store = await StoreRepository.findById(store_id);
            if (role === ROLES.RETAILERADMIN
                && (!store || !canManageRetailer(req.user, store.retailer_id))) {
                return denyStoreAccess(res);
            }
        }
        if (date) {
            loops = await loopRepository.findByDate(date);
            if (store_id) loops = loops.filter(l => l.store_id === store_id);
            if (location_id) loops = loops.filter(l => l.location_id === location_id);
            if (effectiveScreenId) loops = loops.filter(l => l.screen_id === effectiveScreenId);
        } else {
            const where = [];
            if (retailer_id) where.push(['retailer_id', '==', retailer_id]);
            if (store_id) where.push(['store_id', '==', store_id]);
            if (location_id) where.push(['location_id', '==', location_id]);
            if (effectiveScreenId) where.push(['screen_id', '==', effectiveScreenId]);
            loops = await loopRepository.findAll({ where });
        }
        if (role === ROLES.RETAILERADMIN) {
            loops = loops.filter(loop => loop.retailer_id === ownRetailerId);
        }

        // Determine dynamic business hours for UI
        let startHour = 8;
        let endHour = 22;
        let isClosed = false;

        if (date && store_id) {
            const effective = await BusinessHoursService.getEffectiveHours(store_id, date);
            const operatingHours = BusinessHoursService.getOperatingHourRange(effective);
            isClosed = operatingHours.is_closed;
            startHour = operatingHours.start;
            endHour = operatingHours.end;
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

/** A Store's loops for a broadcast date, for the Retailer Administrator's preview and administrators. */
router.get('/review/:storeId/:date', async (req, res) => {
    try {
        const store = await StoreRepository.findById(req.params.storeId);
        if (!store || !canManageRetailer(req.user, store.retailer_id)) return denyStoreAccess(res);
        const loops = await loopRepository.findAll({
            where: [
                ['store_id', '==', store.id],
                ['date', '==', req.params.date],
            ],
        });
        loops.sort((a, b) => a.hour - b.hour);
        return res.json({
            store: { id: store.id, name: store.name, time_zone: store.time_zone },
            broadcast_date: req.params.date,
            loops,
        });
    } catch (error) {
        logger.error('[Loops API] GET review failed', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

/**
 * GET /api/loops/:id
 * Get single loop with slots. Returns screen_count derived from screen_ids.
 *
 * Ordering: wildcard — must remain after all static-segment GET routes.
 */
router.get('/:id', async (req, res) => {
    try {
        const loop = await findAuthorizedLoop(req, res, [ROLES.RETAILERADMIN, ROLES.ADMIN, ROLES.SUPERADMIN]);
        if (!loop) return;
        res.json({
            ...loop,
            screen_count: loop.screen_ids?.length ?? 1
        });
    } catch (error) {
        logger.error('[Loops API] GET /:id failed', { id: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to fetch loop' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST routes — static-segment paths MUST precede /:id wildcard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/loops
 * Demo Seed Bypass: allow superadmin to explicitly inject loops with a specific ID.
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.LOOP_INJECT, ROLES.SUPERADMIN), async (req, res) => {
    try {
        const { id, ...loopData } = req.body;
        const loop = await loopRepository.create(id, loopData);
        res.status(201).json(loop);
    } catch (error) {
        if (error.code === 6 || (error.message && error.message.includes('ALREADY_EXISTS'))) {
            return res.status(409).json({ error: 'Loop already exists' });
        }
        logger.error('[Loops API] POST / failed', { error: error.message });
        res.status(500).json({ error: 'Failed to create loop' });
    }
});

/**
 * POST /api/loops/generate
 * Trigger D-1 loop generation
 * Body: { targetDate, retailerId, storeId }
 * Requires loops.generate: Admin and Super Administrator prepare schedules.
 */
router.post('/generate', authenticate, requirePermission(PERMISSIONS.LOOP_GENERATE), async (req, res) => {
    try {
        const { targetDate, retailerId, storeId } = req.body;

        if (!targetDate || !retailerId || !storeId) {
            return res.status(400).json({
                error: 'Missing required fields: targetDate, retailerId, storeId'
            });
        }

        logger.info('[Loops API] Generating loops', { targetDate, retailerId, storeId });

        const { loops, operatingHours } = await loopGenerationService
            .generateDailySchedule(targetDate, retailerId, storeId);

        // Strict 12-Ad Loop Capacity & 60s Limit Validation (MVP Rule 4.1)
        for (const loop of loops) {
            if (!loop.slots || loop.slots.length !== 12) {
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
                start: operatingHours.start,
                end: operatingHours.end,
                is_closed: operatingHours.is_closed,
                total_loops: loops.length,
            }
        });
    } catch (error) {
        logger.error('[Loops API] POST /generate failed', { error: error.message });
        res.status(500).json({ error: 'Failed to generate loops' });
    }
});

/**
 * PATCH /api/loops/:id/slots/:position/replace
 * Replace a slot with a new asset, in the loop that plays.
 * Body: { assetId }
 * Requires authentication.
 */
router.patch('/:id/slots/:position/replace', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const position = slotPositionFrom(req.params.position);
        const { assetId } = req.body;
        const userId = req.user?.uid || null;

        if (position === null) {
            return res.status(400).json({ error: `Invalid slot position: ${req.params.position}` });
        }
        if (!assetId) {
            return res.status(400).json({ error: 'Replacement assetId is required' });
        }
        const loop = await findAuthorizedLoop(req, res, [ROLES.ADMIN]);
        if (!loop) return;

        const updated = await loopRepository.replaceSlot(id, position, assetId, userId);

        logger.info('[Loops API] Slot replaced', { loopId: id, newLoopId: updated.id, position, assetId });
        res.json(updated);
    } catch (error) {
        logger.error('[Loops API] PATCH /:id/slots/:position/replace failed', { error: error.message });
        res.status(500).json({ error: 'Failed to replace slot' });
    }
});

export default router;
