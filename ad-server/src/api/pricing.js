// Pricing API Routes
// CPM pricing configuration and slot price calculation

import express from 'express';
import PricingRepository from '../repositories/PricingRepository.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/pricing
 * Root stub — returns empty structure so PricingService initialises
 * without a 404 crash.
 */
router.get('/', async (req, res) => {
    try {
        const config = await PricingRepository.getConfig();
        res.json({
            ...config,
            tiers: config.tiers || [],
            meta: { stub: false }
        });
    } catch {
        res.status(200).json({
            tiers: [],
            currency: 'USD',
            billingCycles: [],
            features: {},
            meta: { stub: true, message: 'Pricing not yet configured.' }
        });
    }
});

/**
 * GET /api/pricing/config
 * Get current pricing configuration — admin only.
 * SEC-S15-5: was public; hardened in S15.
 */
router.get('/config', authenticate, authorize(['admin', 'superadmin']), async (req, res) => {
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
 * Update pricing configuration — admin only.
 * SEC-S15-6: was authenticate-only; role guard added in S15.
 */
router.put('/config', authenticate, authorize(['admin', 'superadmin']), async (req, res) => {
    try {
        // Validate allocation sum if provided
        if (req.body.allocation) {
            const { paid = 0, retailer = 0, internal = 0 } = req.body.allocation;
            if (paid + retailer + internal !== 100) {
                return res.status(400).json({ error: 'Allocation must sum to 100' });
            }
        }
        const config = await PricingRepository.updateConfig(req.body);
        res.json(config);
    } catch (error) {
        console.error('Failed to update pricing config:', error);
        res.status(500).json({ error: 'Failed to update pricing config' });
    }
});

/**
 * GET /api/pricing/estimate
 * Estimate cost for a given slot count and CPM rate.
 * Pure calculation — no Firestore dependency.
 * Query params: slots (number), cpm (number)
 */
router.get('/estimate', authenticate, async (req, res) => {
    const slots = parseFloat(req.query.slots);
    const cpm   = parseFloat(req.query.cpm);
    if (isNaN(slots) || isNaN(cpm)) {
        return res.status(400).json({ error: 'slots and cpm are required' });
    }
    return res.json({ estimatedCost: (slots * cpm / 1000).toFixed(4) });
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
