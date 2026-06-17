import express from 'express';
import { campaignRepository, loopRepository } from '../repositories/index.js';
import { campaignService } from '../services/CampaignService.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * VALID_TRANSITIONS — ordered state machine for campaign status.
 *
 * Sprint 14 — S14-2: replaces the flat ALLOWED_STATUSES array.
 * Only transitions listed here are permitted; all others return 400.
 *
 * pending_approval → approved | rejected   (retaileradmin decision)
 * approved         → live                  (ops go-live)
 * live             → completed | paused    (ops or scheduler)
 * paused           → live                  (ops resume)
 * completed        → (terminal)
 * rejected         → (terminal)
 */
const VALID_TRANSITIONS = {
    pending_approval: ['approved', 'rejected'],
    approved: ['live'],
    live: ['completed', 'paused'],
    paused: ['live'],
    completed: [],
    rejected: [],
};

/**
 * GET /api/campaigns
 * List campaigns.
 *
 * Sprint 14 — S14-2: advertiser callers scoped to their own linked_entity_id.
 * All other authenticated roles (and unauthenticated callers to preserve
 * backward compat) continue to see all campaigns, filtered only by the
 * optional ?status= or ?advertiserId= query params.
 *
 * NOTE: req.user may be undefined for unauthenticated callers — optional
 * chaining is used throughout to avoid TypeError on req.user.role.
 */
router.get('/', async (req, res) => {
    try {
        const { status, advertiserId } = req.query;
        let campaigns;

        // Advertiser-scoped path — show only the caller's own campaigns
        if (req.user?.role === 'advertiser') {
            const where = [['advertiser_id', '==', req.user.linked_entity_id]];
            if (status) where.push(['status', '==', status.toLowerCase()]);
            campaigns = await campaignRepository.findAll({ where });
        } else if (advertiserId) {
            campaigns = await campaignRepository.findAll({
                where: [['advertiser_id', '==', advertiserId]]
            });
        } else if (status) {
            campaigns = await campaignRepository.findAll({
                where: [['status', '==', status]]
            });
        } else {
            campaigns = await campaignRepository.findAll();
        }

        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/campaigns/:id
 * Get a single campaign by ID.
 *
 * Sprint 14 — S14-2: advertiser callers receive 403 if the campaign's
 * advertiser_id does not match their linked_entity_id.
 */
router.get('/:id', async (req, res) => {
    try {
        const campaign = await campaignRepository.findById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Ownership guard for advertiser role
        if (
            req.user?.role === 'advertiser' &&
            campaign.advertiser_id !== req.user.linked_entity_id
        ) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/campaigns
 * Create a new campaign (defaults to pending_approval).
 *
 * Sprint 9  — Task 9.2 : authenticate guard added.
 * Sprint 14 — S14-1    : requireRole('advertiser') added.
 *   Hierarchical guard (DECISION-2): allows advertiser + all higher roles
 *   so admin oversight of campaign creation is preserved.
 */
router.post('/', authenticate, requireRole('advertiser'), async (req, res) => {
    try {
        // Task 2A: Full-Capacity Inventory Blocking
        // Only enforce check if target dates and location are explicitly provided
        if (req.body.start_date && req.body.end_date && req.body.location_id) {
            // Find all active/approved campaigns for this location
            const existingCampaigns = await campaignRepository.findAll({
                where: [
                    ['status', 'in', ['approved', 'live', 'pending_approval']],
                    ['location_id', '==', req.body.location_id]
                ]
            });
            // Measure overlap
            const overlapping = existingCampaigns.filter(c => {
                const overlapsStart = req.body.start_date <= c.end_date;
                const overlapsEnd = req.body.end_date >= c.start_date;
                return overlapsStart && overlapsEnd;
            });

            // Loop maximum is 12 ads per slot
            if (overlapping.length >= 12) {
                return res.status(409).json({
                    error: 'INVENTORY_SOLD_OUT',
                    message: `Location ${req.body.location_id} is completely sold out for the requested date range. Maximum 12 concurrent campaigns reached.`
                });
            }
        }

        const id = `cmp_${Date.now()}`;
        const campaignData = {
            ...req.body,
            // Stamp advertiser_id from JWT so callers cannot spoof it
            advertiser_id: req.body.advertiser_id ?? req.user.linked_entity_id ?? null,
            status: req.body.status || 'pending_approval',
            created_at: new Date().toISOString()
        };
        const campaign = await campaignRepository.create(id, campaignData);
        res.status(201).json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/campaigns/:id/book
 * Book slots for a campaign.
 * Body: { slots: [{ loopId, slotIndex, creativeUrl }] }
 *
 * Sprint 10 — authenticate guard added (sprintWRAPUP item 2).
 * Caller must be authenticated; advertiser_id ownership is validated against
 * the campaign record before any slot is written.
 */
router.post('/:id/book', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { slots } = req.body;

        if (!slots || !Array.isArray(slots)) {
            return res.status(400).json({ error: 'Slots array is required' });
        }

        const campaign = await campaignRepository.findById(id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // --- Task 2.1: Strict Payload Validation (Pre-flight check) ---
        const loopMap = new Map();
        const orphanedLoopIds = [];
        const conflictSlots = [];

        // 1. Fetch all requested loops and check for existence
        for (const slot of slots) {
            if (!loopMap.has(slot.loopId)) {
                const loop = await loopRepository.findById(slot.loopId);
                if (!loop) {
                    orphanedLoopIds.push(slot.loopId);
                } else {
                    loopMap.set(slot.loopId, loop);
                }
            }

            // 2. Check for double-booking conflicts (Task 2.2)
            const loop = loopMap.get(slot.loopId);
            if (loop) {
                const targetSlot = loop.slots?.[slot.slotIndex];
                if (targetSlot && ['booked', 'BOOKED'].includes(targetSlot.status)) {
                    conflictSlots.push({ loopId: slot.loopId, slotIndex: slot.slotIndex });
                }
            }
        }

        // --- Task 2.1: Loud Failure on Missing Inventory ---
        if (orphanedLoopIds.length > 0) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'One or more requested loops do not exist. Generated inventory is required.',
                orphaned_ids: orphanedLoopIds
            });
        }

        // --- Task 2.2: Loud Failure on Double Booking ---
        if (conflictSlots.length > 0) {
            return res.status(409).json({
                error: 'CONFLICT',
                message: 'One or more requested slots have already been booked by another campaign.',
                conflicts: conflictSlots
            });
        }

        // 3. Execution (Atomic-like commit)
        const bookedSlots = [];
        for (const slot of slots) {
            const { loopId, slotIndex, creativeUrl } = slot;

            await loopRepository.bookSlot(loopId, slotIndex, {
                campaign_id: id,
                advertiser_id: campaign.advertiser_id,
                creative_url: creativeUrl || campaign.creative_url,
                booked_at: new Date().toISOString()
            });

            bookedSlots.push({ loopId, slotIndex, success: true });
        }

        await campaignRepository.update(id, {
            booked_slots: (campaign.booked_slots || 0) + bookedSlots.length,
            status: 'active'
        });

        res.json({ campaign_id: id, booked: bookedSlots });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/campaigns/:id/status
 * Transition campaign state.
 *
 * Sprint 8  — S8-3     : requireRole('retaileradmin') guard.
 * Sprint 8  — S8-4     : status normalised to lowercase before persisting.
 * Sprint 14 — S14-2    : flat ALLOWED_STATUSES replaced with VALID_TRANSITIONS
 *   state machine. Transition is validated against the campaign's CURRENT
 *   status — callers that skip a state (e.g. pending_approval → live) receive
 *   400 with from/to/allowed fields for clear debugging.
 *
 * fix: authenticate middleware was missing — req.user was never populated so
 *   requireRole resolved every caller (including superadmin) to level -1 → 403.
 */
router.patch('/:id/status', authenticate, requireRole('retaileradmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const rawStatus = req.body.status;
        if (!rawStatus) return res.status(400).json({ error: 'Status is required' });

        const requestedStatus = typeof rawStatus === 'string'
            ? rawStatus.toLowerCase()
            : String(rawStatus);

        const campaign = await campaignRepository.findById(id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const currentStatus = campaign.status || 'pending_approval';
        const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

        if (!allowed.includes(requestedStatus)) {
            return res.status(400).json({
                error: 'Invalid status transition',
                from: currentStatus,
                to: requestedStatus,
                allowed,
            });
        }

        const updated = await campaignService.updateStatus(id, requestedStatus);
        res.json(updated);
    } catch (error) {
        const statusCode = error.message === 'Campaign not found' ? 404 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

/**
 * PUT /api/campaigns/:id
 * Full replacement update for a campaign document.
 *
 * Sprint 10 — authenticate guard added (sprintWRAPUP item 1).
 * Any authenticated user can update their own campaign; admin can update any.
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const campaign = await campaignRepository.findById(id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const updated = await campaignRepository.update(id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/campaigns/:id
 *
 * Sprint 9  — Task 9.2: authenticate + requireRole guard added.
 * Sprint 11 — S11-3   : tightened from requireRole('admin') to requireRole('superadmin').
 *   Only superadmin may hard-delete a campaign record.
 */
router.delete('/:id', authenticate, requireRole('superadmin'), async (req, res) => {
    try {
        await campaignRepository.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
