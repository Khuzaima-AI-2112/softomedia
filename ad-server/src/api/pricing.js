// Pricing API Routes
// CPM pricing configuration and slot price calculation

import express from 'express';
import PricingRepository from '../repositories/PricingRepository.js';
import { platformAuditRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatformGovernance } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * GET /api/pricing/config
 * Get current pricing configuration — Super Administrator only.
 * SEC-S15-5: was public; hardened in S15.
 */
router.get('/config', authenticate, requirePlatformGovernance, async (req, res) => {
    try {
        const config = await PricingRepository.getConfig();
        res.json(config);
    } catch (error) {
        console.error('Failed to fetch pricing config:', error);
        res.status(500).json({ error: 'Failed to fetch pricing config' });
    }
});

/**
 * PUT /api/pricing/config
 * Update pricing configuration — Super Administrator only.
 * SEC-S15-6: was authenticate-only; role guard added in S15.
 */
router.put('/config', authenticate, requirePlatformGovernance, async (req, res) => {
    try {
        // Validate allocation sum if provided
        if (req.body.allocation) {
            const { paid = 0, retailer = 0, internal = 0 } = req.body.allocation;
            if (paid + retailer + internal !== 100) {
                return res.status(400).json({ error: 'Allocation must sum to 100' });
            }
        }
        const config = await PricingRepository.updateConfigWithAudit(req.body, platformAuditRepository, {
            action: 'pricing_config_updated',
            actor_id: req.user.id || req.user.uid,
            actor_role: req.user.role,
            changes: req.body,
        });
        res.json(config);
    } catch (error) {
        console.error('Failed to update pricing config:', error);
        res.status(500).json({ error: 'Failed to update pricing config' });
    }
});

/**
 * POST /api/pricing/overrides
 * Set a date-specific pricing override — Super Administrator only (global pricing).
 */
router.post('/overrides', authenticate, requirePlatformGovernance, async (req, res) => {
    try {
        const { date, ...overrides } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const override = await PricingRepository.setDateOverride(date, overrides);
        res.status(201).json(override);
    } catch (error) {
        console.error('Failed to set pricing override:', error);
        res.status(500).json({ error: 'Failed to set pricing override' });
    }
});

export default router;
