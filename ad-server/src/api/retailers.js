import express from 'express';
import { retailerRepository } from '../repositories/RetailerRepository.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/retailers
 * List all retailers
 */
router.get('/', async (req, res) => {
    try {
        const retailers = await retailerRepository.findAll();
        res.json(retailers);
    } catch (error) {
        logger.error('Failed to fetch retailers:', error);
        res.status(500).json({ error: 'Failed to fetch retailers' });
    }
});

/**
 * GET /api/retailers/:id
 * Get a single retailer by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const retailer = await retailerRepository.findById(req.params.id);
        if (!retailer) {
            return res.status(404).json({ error: 'Retailer not found' });
        }
        res.json(retailer);
    } catch (error) {
        logger.error('Failed to fetch retailer:', error);
        res.status(500).json({ error: 'Failed to fetch retailer' });
    }
});

/**
 * POST /api/retailers
 * Create a new retailer
 */
router.post('/', async (req, res) => {
    try {
        const retailer = await retailerRepository.create(req.body.id, req.body);
        res.status(201).json(retailer);
    } catch (error) {
        logger.error('Failed to create retailer:', error);
        res.status(500).json({ error: 'Failed to create retailer' });
    }
});

/**
 * PUT /api/retailers/:id
 * Update a retailer
 */
router.put('/:id', async (req, res) => {
    try {
        const retailer = await retailerRepository.update(req.params.id, req.body);
        res.json(retailer);
    } catch (error) {
        logger.error('Failed to update retailer:', error);
        res.status(500).json({ error: 'Failed to update retailer' });
    }
});

/**
 * DELETE /api/retailers/:id
 * Soft-delete a retailer (sets status to 'inactive')
 * Preserves referential integrity with stores, screens, loops, impressions
 */
router.delete('/:id', async (req, res) => {
    try {
        const updated = await retailerRepository.softDelete(req.params.id);
        res.status(200).json(updated);
    } catch (error) {
        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ error: 'Retailer not found' });
        }
        logger.error('Failed to delete retailer:', error);
        res.status(500).json({ error: 'Failed to delete retailer' });
    }
});

/**
 * PATCH /api/retailers/:id
 * Toggle retailer status between 'active' and 'inactive'
 */
router.patch('/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['active', 'inactive'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
        }
        const updated = await retailerRepository.updateStatus(req.params.id, status);
        res.status(200).json(updated);
    } catch (error) {
        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ error: 'Retailer not found' });
        }
        logger.error('Failed to update retailer status:', error);
        res.status(500).json({ error: 'Failed to update retailer status' });
    }
});

export default router;
