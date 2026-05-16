// Pricing API Routes
// CPM pricing configuration and slot price calculation

import express from 'express';
import PricingRepository from '../repositories/PricingRepository.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/pricing/config
 * Get current pricing configuration
 */
router.get('/config', async (req, res) => {
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
 * Update pricing configuration (requires auth)
 */
router.put('/config', authenticate, async (req, res) => {
    try {
        const config = await PricingRepository.updateConfig(req.body);
        res.json(config);
    } catch (error) {
        console.error('Failed to update pricing config:', error);
        res.status(500).json({ error: 'Failed to update pricing config' });
    }
});

/**
 * POST /api/pricing/overrides
 * Set a date-specific pricing override (requires auth)
 */
router.post('/overrides', authenticate, async (req, res) => {
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

/**
 * GET /api/pricing/overrides/:date
 * Get pricing override for a specific date
 */
router.get('/overrides/:date', async (req, res) => {
    try {
        const override = await PricingRepository.getDateOverride(req.params.date);
        if (!override) {
            return res.status(404).json({ error: 'No override for this date' });
        }
        res.json(override);
    } catch (error) {
        console.error('Failed to fetch pricing override:', error);
        res.status(500).json({ error: 'Failed to fetch pricing override' });
    }
});

/**
 * GET /api/pricing/calculate
 * Calculate slot price for given hour
 * Query params: hour, screenId (optional)
 */
router.get('/calculate', async (req, res) => {
    try {
        const hour = parseInt(req.query.hour);
        const screenId = req.query.screenId;

        if (isNaN(hour) || hour < 0 || hour > 23) {
            return res.status(400).json({ error: 'Valid hour (0-23) is required' });
        }

        const pricing = await PricingRepository.calculateSlotPrice(hour, screenId);
        res.json(pricing);
    } catch (error) {
        console.error('Failed to calculate price:', error);
        res.status(500).json({ error: 'Failed to calculate price' });
    }
});

export default router;
