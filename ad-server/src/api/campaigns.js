import express from 'express';
import { campaignRepository } from '../repositories/index.js';
import { campaignService } from '../services/CampaignService.js';

const router = express.Router();

/**
 * GET /api/campaigns
 * List campaigns with optional status filtering
 */
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let campaigns;
        if (status) {
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
 * POST /api/campaigns
 * Create a new campaign (defaults to pending_approval)
 */
router.post('/', async (req, res) => {
    try {
        const id = `cmp_${Date.now()}`;
        const campaignData = {
            ...req.body,
            status: 'pending_approval',
            created_at: new Date().toISOString()
        };
        const campaign = await campaignRepository.create(id, campaignData);
        res.status(201).json(campaign);
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
