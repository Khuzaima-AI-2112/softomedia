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
 */
router.post('/', async (req, res) => {
    try {
        const advertiser = await advertiserRepository.create(req.body.id, req.body);
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

export default router;
