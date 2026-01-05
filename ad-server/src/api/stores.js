// Stores API Routes
// CRUD operations for physical store locations

import express from 'express';
import StoreRepository from '../repositories/StoreRepository.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stores
 * List all stores, optionally filtered by retailer
 */
router.get('/', async (req, res) => {
    try {
        const { retailerId } = req.query;
        let stores;

        if (retailerId) {
            stores = await StoreRepository.getByRetailer(retailerId);
        } else {
            stores = await StoreRepository.findAll();
        }

        res.json(stores);
    } catch (error) {
        console.error('Failed to fetch stores:', error);
        res.status(500).json({ error: 'Failed to fetch stores' });
    }
});

/**
 * GET /api/stores/:id
 * Get a single store by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const store = await StoreRepository.findById(req.params.id);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(store);
    } catch (error) {
        console.error('Failed to fetch store:', error);
        res.status(500).json({ error: 'Failed to fetch store' });
    }
});

/**
 * POST /api/stores
 * Create a new store (requires auth)
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, retailer_id, address, city, state, screen_count } = req.body;

        if (!name || !retailer_id) {
            return res.status(400).json({ error: 'Name and retailer_id are required' });
        }

        const store = await StoreRepository.createWithScreens({
            name,
            retailer_id,
            address: address || '',
            city: city || '',
            state: state || '',
            location: { lat: 0, lng: 0 }
        }, screen_count || 0);

        res.status(201).json(store);
    } catch (error) {
        console.error('Failed to create store:', error);
        res.status(500).json({ error: 'Failed to create store' });
    }
});

/**
 * PUT /api/stores/:id
 * Update a store (requires auth)
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const store = await StoreRepository.update(req.params.id, req.body);
        res.json(store);
    } catch (error) {
        console.error('Failed to update store:', error);
        res.status(500).json({ error: 'Failed to update store' });
    }
});

/**
 * DELETE /api/stores/:id
 * Delete a store (requires auth)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        await StoreRepository.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete store:', error);
        res.status(500).json({ error: 'Failed to delete store' });
    }
});

export default router;
