// Stores API Routes
// CRUD operations for physical store locations

import express from 'express';
import StoreRepository from '../repositories/StoreRepository.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stores
 * List all stores, optionally filtered by retailer.
 *
 * Accepts all three spellings for backwards compatibility:
 *   ?retailer_id=  (snake_case — canonical, matches POST body convention)
 *   ?retailerId=   (camelCase  — original backend convention)
 *   ?retailerid=   (lowercase  — sent by LoopDemoPlayer cascade selector)
 */
router.get('/', async (req, res) => {
    try {
        const retailerId = req.query.retailer_id || req.query.retailerId || req.query.retailerid;
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
 * Full update a store (requires auth)
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
 * PATCH /api/stores/:id
 * Partial update — only overwrites supplied fields.
 * Used for status toggles and inline field edits.
 */
router.patch('/:id', authenticate, async (req, res) => {
    try {
        const store = await StoreRepository.update(req.params.id, req.body);
        res.json(store);
    } catch (error) {
        console.error('Failed to patch store:', error);
        res.status(500).json({ error: 'Failed to patch store' });
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

/**
 * GET /api/stores/:id/hours
 * Get effective hours for a specific date
 */
router.get('/:id/hours', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD)' });
        }
        const hours = await BusinessHoursService.getEffectiveHours(req.params.id, date);
        res.json(hours);
    } catch (error) {
        console.error('Failed to fetch effective hours:', error);
        res.status(500).json({ error: 'Failed to fetch effective hours' });
    }
});

/**
 * GET /api/stores/:id/weekly-hours
 * Get default weekly schedule
 */
router.get('/:id/weekly-hours', async (req, res) => {
    try {
        const hours = await BusinessHoursService.getWeeklyHours(req.params.id);
        res.json(hours);
    } catch (error) {
        console.error('Failed to fetch weekly hours:', error);
        res.status(500).json({ error: 'Failed to fetch weekly hours' });
    }
});

/**
 * PUT /api/stores/:id/weekly-hours
 * Update default weekly schedule
 */
router.put('/:id/weekly-hours', authenticate, async (req, res) => {
    try {
        const hours = await BusinessHoursService.updateWeeklyHours(req.params.id, req.body.weekly_hours);
        res.json(hours);
    } catch (error) {
        console.error('Failed to update weekly hours:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/stores/:id/special-hours
 * Update special hours for a date
 */
router.put('/:id/special-hours', authenticate, async (req, res) => {
    try {
        const { date, ...hoursData } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        const hours = await BusinessHoursService.updateSpecialHours(req.params.id, date, hoursData);
        res.json(hours);
    } catch (error) {
        console.error('Failed to update special hours:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/stores/:id/special-hours
 * Get all special hours for a store
 */
router.get('/:id/special-hours', async (req, res) => {
    try {
        const hours = await BusinessHoursService.listSpecialHours(req.params.id);
        res.json(hours);
    } catch (error) {
        console.error('Failed to fetch special hours list:', error);
        res.status(500).json({ error: 'Failed to fetch special hours list' });
    }
});

export default router;
