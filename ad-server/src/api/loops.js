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
 *
 * Route ordering fix (2026-06-18): All static-segment routes hoisted
 * above wildcard /:id routes. GET /pending/:retailerId and
 * POST /locations/:locationId/loops/approve-all were previously shadowed
 * by their respective /:id wildcard handlers.
 */

import express from 'express';
import { loopRepository, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { loopGenerationService } from '../services/LoopGenerationService.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { approvalWindowService, ApprovalWindowError } from '../services/ApprovalWindowService.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { canManageRetailer, denyStoreAccess, retailerIdFor } from '../middleware/storeManagement.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import logger from '../utils/logger.js';

const router = express.Router();

function actorFor(user) {
    return {
        id: user?.uid || user?.id,
        role: normalizeRole(user?.role),
    };
}

async function findAuthorizedLoop(req, res, allowedRoles) {
    if (req.user && !allowedRoles.includes(normalizeRole(req.user.role))) {
        denyStoreAccess(res);
        return null;
    }
    const loop = await loopRepository.findById(req.params.id || req.params.loopId);
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

function sendApprovalError(res, error, fallback) {
    if (error instanceof ApprovalWindowError) {
        return res.status(error.status).json({ error: error.message });
    }
    logger.error(fallback, { error: error.message });
    return res.status(500).json({ error: 'Approval operation failed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET routes — static-segment paths MUST precede /:id wildcard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/loops
 * List loops with optional filters
 * Query params: date, retailer_id, store_id, location_id, screen_id, screenid, status
 */
router.get('/', async (req, res) => {
    try {
        const { date, retailer_id, store_id, location_id, screen_id, screenid, status } = req.query;

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
            if (status) where.push(['status', '==', status]);
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

/** Store-scoped review read model used by Retailer Administrator and administrators. */
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
            approval_window: await approvalWindowService.describe(store, req.params.date),
            loops,
        });
    } catch (error) {
        return sendApprovalError(res, error, '[Loops API] GET review failed');
    }
});

/**
 * GET /api/loops/pending/:retailerId
 * Get all pending loops for retailer validation.
 *
 * Sprint 10 — sprintWRAPUP item 3: authenticate + requireRole('retaileradmin')
 * added. This endpoint exposes unapproved campaign content — it must not be
 * publicly readable.
 *
 * Ordering: registered before GET /:id to prevent "pending" being matched
 * as a loop ID param.
 */
router.get('/pending/:retailerId', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        if (req.params.retailerId !== retailerIdFor(req.user)) return denyStoreAccess(res);
        const loops = await loopRepository.findPendingByRetailer(req.params.retailerId);
        res.json({ loops, count: loops.length });
    } catch (error) {
        logger.error('[Loops API] GET /pending/:retailerId failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch pending loops' });
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
router.post('/', authenticate, requireRole('superadmin'), async (req, res) => {
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
 * Requires authentication (defence-in-depth — router is also behind authenticate).
 */
router.post('/generate', authenticate, async (req, res) => {
    try {
        const { targetDate, retailerId, storeId, mock } = req.body;

        if (!targetDate || !retailerId || !storeId) {
            return res.status(400).json({
                error: 'Missing required fields: targetDate, retailerId, storeId'
            });
        }

        logger.info('[Loops API] Generating loops', { targetDate, retailerId, storeId, mock });

        let loops;
        let operatingHours;
        if (mock) {
            loops = await loopGenerationService.generateMockLoops(targetDate, retailerId, storeId);
            const effectiveHours = await BusinessHoursService.getEffectiveHours(storeId, targetDate);
            operatingHours = BusinessHoursService.getOperatingHourRange(effectiveHours);
        } else {
            const schedule = await loopGenerationService.generateDailySchedule(targetDate, retailerId, storeId);
            loops = schedule.loops;
            operatingHours = schedule.operatingHours;
        }

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

/** Reopen an expired Store-local Approval Window without approving content. */
router.post('/review/:storeId/:date/reopen', async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(role)) return denyStoreAccess(res);
        const store = await StoreRepository.findById(req.params.storeId);
        if (!store || !canManageRetailer(req.user, store.retailer_id)) return denyStoreAccess(res);
        const approvalWindow = await approvalWindowService.reopen(store, req.params.date, {
            reason: req.body.reason,
            expiresAt: req.body.expires_at,
            actor: actorFor(req.user),
        });
        return res.json(approvalWindow);
    } catch (error) {
        return sendApprovalError(res, error, '[Loops API] POST review reopen failed');
    }
});

/**
 * POST /api/loops/:loopId/reject
 * Reject an entire loop (loop-level rejection, distinct from slot-level PATCH above).
 * Sets loops.status to LOOP_STATUS.REJECTED.
 * Body: { reason }
 * Auth: requireRole('retaileradmin')
 *
 * Ordering: wildcard POST — must remain after all static-segment POST routes.
 *
 * S13-2 AC-1, AC-3, AC-5
 */
router.post('/:loopId/reject', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        const { loopId } = req.params;
        const reason = req.body.reason?.trim();
        if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
        const loop = await findAuthorizedLoop(req, res, [ROLES.RETAILERADMIN]);
        if (!loop) return;
        const store = await StoreRepository.findById(loop.store_id);
        if (!store) return res.status(409).json({ error: 'Loop is not assigned to a Store' });
        await approvalWindowService.assertOpen(store, loop.date);

        const updated = await loopRepository.update(loopId, {
            status: LOOP_STATUS.REJECTED,
            rejection_reason: reason,
            rejected_at: new Date().toISOString(),
            rejected_by: req.user?.uid || null,
        });

        logger.info('[Loops API] Loop rejected', { loopId, reason, userId: req.user?.uid });
        res.json(updated);
    } catch (error) {
        return sendApprovalError(res, error, '[Loops API] POST /:loopId/reject failed');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH routes — all are /:id/* so ordering within this group does not matter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/loops/:id/approve
 * Approve entire loop.
 * userId is derived exclusively from the authenticated token — no anonymous fallback.
 * Requires authentication.
 */
router.patch('/:id/approve', authenticate, async (req, res) => {
    try {
        const loop = await findAuthorizedLoop(req, res, [ROLES.RETAILERADMIN]);
        if (!loop) return;
        const userId = req.user?.uid || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authenticated user required' });
        }

        const store = await StoreRepository.findById(loop.store_id);
        if (!store) return res.status(409).json({ error: 'Loop is not assigned to a Store' });
        await approvalWindowService.assertOpen(store, loop.date);
        const updated = await loopRepository.approveLoop(req.params.id, userId);

        logger.info('[Loops API] Loop approved', { loopId: req.params.id, userId });
        res.json(updated);
    } catch (error) {
        if (error instanceof ApprovalWindowError) return sendApprovalError(res, error, '[Loops API] PATCH approve failed');
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
        const reason = req.body.reason?.trim();

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        const loop = await findAuthorizedLoop(req, res, [ROLES.RETAILERADMIN]);
        if (!loop) return;
        const store = await StoreRepository.findById(loop.store_id);
        if (!store) return res.status(409).json({ error: 'Loop is not assigned to a Store' });
        await approvalWindowService.assertOpen(store, loop.date);

        const updated = await loopRepository.rejectSlot(id, position, reason, actorFor(req.user).id);

        logger.info('[Loops API] Slot rejected', { loopId: id, position, reason });
        res.json(updated);
    } catch (error) {
        return sendApprovalError(res, error, '[Loops API] PATCH slot reject failed');
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
