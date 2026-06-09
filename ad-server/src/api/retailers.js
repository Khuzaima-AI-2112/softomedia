import express from 'express';
import { retailerRepository } from '../repositories/RetailerRepository.js';
import logger from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * GET /api/retailers
 * List all non-deleted retailers — public within dashboard shell (all roles can read).
 * S17-3: filters where deleted_at == null so soft-deleted retailers are excluded.
 * Intentionally-inactive retailers (PATCH toggle, no deleted_at) are still returned.
 */
router.get('/', async (req, res) => {
    try {
        const retailers = await retailerRepository.findAll({
            where: [['deleted_at', '==', null]]
        });
        res.json(retailers);
    } catch (error) {
        logger.error('Failed to fetch retailers:', error);
        res.status(500).json({ error: 'Failed to fetch retailers' });
    }
});

/**
 * GET /api/retailers/:id
 * Get a single retailer by ID — public within dashboard shell.
 * S17-4: returns 404 if the retailer has been soft-deleted (deleted_at is set).
 */
router.get('/:id', async (req, res) => {
    try {
        const retailer = await retailerRepository.findById(req.params.id);
        if (!retailer || retailer.deleted_at) {
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
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added.
 */
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { name, contact_email, contract_start, logo, status } = req.body;

        const errors = [];

        if (!name || typeof name !== 'string' || name.trim().length < 1) {
            errors.push('Name is required and must be a non-empty string');
        }

        if (!contact_email || typeof contact_email !== 'string') {
            errors.push('Contact email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                errors.push('Contact email must be a valid email address');
            }
        }

        if (!contract_start || typeof contract_start !== 'string') {
            errors.push('Contract start date is required');
        } else if (isNaN(Date.parse(contract_start))) {
            errors.push('Contract start date must be a valid date string (YYYY-MM-DD)');
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' | ') });
        }

        const retailerData = {
            name: name.trim(),
            contact_email: contact_email.trim(),
            contract_start: contract_start.trim(),
            logo: logo || '\uD83C\uDFEA',
            status: status && ['active', 'inactive'].includes(status) ? status : 'active'
        };

        const createdRetailer = await retailerRepository.createNew(retailerData);
        res.status(201).json(createdRetailer);
    } catch (error) {
        logger.error('Failed to create retailer:', error);
        res.status(500).json({ error: 'Failed to create retailer' });
    }
});

/**
 * PUT /api/retailers/:id
 * Update a retailer.
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added.
 */
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
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
 * Soft-delete a retailer (sets status: 'inactive' and deleted_at timestamp).
 * Preserves referential integrity with stores, screens, loops, impressions.
 * Record is excluded from GET / list after this operation.
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added.
 * S17-1: deleted_at field written to Firestore as canonical deletion marker.
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
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
 * Toggle retailer status between 'active' and 'inactive'.
 * Does NOT set deleted_at — this is intentional deactivation, not deletion.
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added.
 */
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
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
