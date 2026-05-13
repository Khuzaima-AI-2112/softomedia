import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { retailerRepository } from '../repositories/RetailerRepository.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const firestore = new Firestore();

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
 * Create a new retailer.
 * Sprint 5 fix: generate a Firestore auto-ID when req.body.id is missing,
 * so we never write to retailers/undefined.
 */
router.post('/', async (req, res) => {
    try {
        // Use provided id or generate a new Firestore doc ID
        const id = req.body.id || firestore.collection('retailers').doc().id;
        const retailer = await retailerRepository.create(id, { ...req.body, id });
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
 * Soft delete a retailer
 */
router.delete('/:id', async (req, res) => {
    try {
        await retailerRepository.update(req.params.id, { status: 'inactive' });
        res.json({ message: 'Retailer deleted', id: req.params.id });
    } catch (error) {
        logger.error('Failed to delete retailer:', error);
        res.status(500).json({ error: 'Failed to delete retailer' });
    }
});

export default router;
