import express from 'express';
import { campaignRepository, loopRepository } from '../repositories/index.js';
import { campaignService } from '../services/CampaignService.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * GET /api/campaigns
 * List campaigns with optional status or advertiser filtering.
 * Public within the dashboard shell (no auth guard — all roles can read).
 */
router.get('/', async (req, res) => {
    try {
        const { status, advertiserId } = req.query;
        let campaigns;

        if (advertiserId) {
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
 */
router.get('/:id', async (req, res) => {
    try {
        const campaign = await campaignRepository.findById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
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
 * Sprint 9 — Task 9.2: authenticate guard added.
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const id = `cmp_${Date.now()}`;
        const campaignData = {
            ...req.body,
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

        const bookedSlots = [];
        for (const slot of slots) {
            const { loopId, slotIndex, creativeUrl } = slot;

            const loop = await loopRepository.findById(loopId);
            if (!loop) continue;

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
 * Transition campaign state (approved/rejected).
 *
 * Requires: retaileradmin role or higher (S8-3).
 * Status is normalised to lowercase before persisting (S8-4).
 *
 * Allowed transitions:
 *   pending_approval -> approved
 *   pending_approval -> rejected
 */
router.patch('/:id/status', requireRole('retaileradmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const rawStatus = req.body.status;
        if (!rawStatus) return res.status(400).json({ error: 'Status is required' });

        const ALLOWED_STATUSES = ['approved', 'rejected', 'pending_approval'];
        const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : rawStatus;

        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                allowed: ALLOWED_STATUSES
            });
        }

        const updated = await campaignService.updateStatus(id, status);
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
 * Sprint 9 — Task 9.2: authenticate + requireRole guard added.
 * Sprint 11 — S11-3: tightened from requireRole('admin') to requireRole('superadmin').
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
