import express from 'express';
import { campaignRepository, loopRepository } from '../repositories/index.js';
import { campaignService } from '../services/CampaignService.js';

const router = express.Router();

/**
 * GET /api/campaigns
 * List campaigns with optional status or advertiser filtering
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
 * Get a single campaign by ID
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
 * Create a new campaign (defaults to pending_approval)
 */
router.post('/', async (req, res) => {
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
 * Book slots for a campaign
 * Body: { slots: [{ loopId, slotIndex, creativeUrl }] }
 */
router.post('/:id/book', async (req, res) => {
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

            // Get the loop
            const loop = await loopRepository.findById(loopId);
            if (!loop) continue;

            // Book the slot
            const updatedLoop = await loopRepository.bookSlot(loopId, slotIndex, {
                campaign_id: id,
                advertiser_id: campaign.advertiser_id,
                creative_url: creativeUrl || campaign.creative_url,
                booked_at: new Date().toISOString()
            });

            bookedSlots.push({ loopId, slotIndex, success: true });
        }

        // Update campaign with booked slot count
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
 * Transition campaign state (approved/rejected)
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'Status is required' });

        const updated = await campaignService.updateStatus(id, status);
        res.json(updated);
    } catch (error) {
        const status = error.message === 'Campaign not found' ? 404 : 500;
        res.status(status).json({ error: error.message });
    }
});

export default router;
