import express from 'express';
import { advertiserRepository } from '../repositories/AdvertiserRepository.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/advertisers
 * List all advertisers
 */
router.get('/', async (req, res) => {
    try {
        const advertisers = await advertiserRepository.findAll();
        res.json(advertisers);
    } catch (error) {
        logger.error('Failed to fetch advertisers:', error);
        res.status(500).json({ error: 'Failed to fetch advertisers' });
    }
});

/**
 * GET /api/advertisers/:id
 * Get a single advertiser by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const advertiser = await advertiserRepository.findById(req.params.id);
        if (!advertiser) {
            return res.status(404).json({ error: 'Advertiser not found' });
        }
        res.json(advertiser);
    } catch (error) {
        logger.error('Failed to fetch advertiser:', error);
        res.status(500).json({ error: 'Failed to fetch advertiser' });
    }
});

/**
 * POST /api/advertisers
 * Create a new advertiser
 * Required fields: name, logo, industry, contactemail, budget, status
 * Document ID is prefixed with 'adv_'
 */
router.post('/', async (req, res) => {
    try {
        const { name, logo, industry, contactemail, budget, status } = req.body;

        // --- Validation ---
        const errors = [];
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            errors.push('name is required');
        }
        if (!logo || typeof logo !== 'string' || logo.trim().length === 0) {
            errors.push('logo is required');
        }
        if (!industry || typeof industry !== 'string' || industry.trim().length === 0) {
            errors.push('industry is required');
        }
        if (!contactemail || typeof contactemail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactemail)) {
            errors.push('contactemail must be a valid email address');
        }
        if (budget === undefined || budget === null || isNaN(Number(budget)) || Number(budget) < 0) {
            errors.push('budget must be a non-negative number');
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('; ') });
        }

        // --- Generate adv_-prefixed document ID ---
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const docId = `adv_${timestamp}_${random}`;

        const data = {
            name: name.trim(),
            logo: logo.trim(),
            industry: industry.trim(),
            contactemail: contactemail.trim().toLowerCase(),
            budget: Number(budget),
            status: status || 'active'
        };

        const advertiser = await advertiserRepository.create(docId, data);
        res.status(201).json(advertiser);
    } catch (error) {
        logger.error('Failed to create advertiser:', error);
        res.status(500).json({ error: 'Failed to create advertiser' });
    }
});

/**
 * PUT /api/advertisers/:id
 * Update an advertiser
 */
router.put('/:id', async (req, res) => {
    try {
        const advertiser = await advertiserRepository.update(req.params.id, req.body);
        res.json(advertiser);
    } catch (error) {
        logger.error('Failed to update advertiser:', error);
        res.status(500).json({ error: 'Failed to update advertiser' });
    }
});

/**
 * DELETE /api/advertisers/:id
 * Soft-delete: sets status to 'suspended'
 * Preserves referential integrity with campaigns that reference advertiserid
 */
router.delete('/:id', async (req, res) => {
    try {
        const updated = await advertiserRepository.softDelete(req.params.id);
        res.status(200).json(updated);
    } catch (error) {
        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ error: 'Advertiser not found' });
        }
        logger.error('Failed to delete advertiser:', error);
        res.status(500).json({ error: 'Failed to delete advertiser' });
    }
});

export default router;
