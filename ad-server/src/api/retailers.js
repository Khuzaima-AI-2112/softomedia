import express from 'express';
import { retailerRepository } from '../repositories/RetailerRepository.js';
import logger from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { requireOrganizationManagement } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * GET /api/retailers
 * List all non-deleted retailers — any signed-in user can read.
 * S17-3: soft-deleted retailers (deleted_at set) are excluded.
 * Intentionally-inactive retailers (PATCH toggle, no deleted_at) are still returned
 * in the default (no query param) response for admin awareness.
 *
 * S21-4: ?for=campaign branch
 * When ?for=campaign is present, the response is further filtered to only retailers
 * with status='active'. This is the endpoint the Campaign Wizard and scheduler use
 * to populate retailer dropdowns with only bookable (active) venues.
 * Inactive retailers (deactivated via PATCH toggle, no deleted_at) are excluded.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { for: forParam } = req.query;
        // Scheduler/CampaignWizard context: active retailers only.
        const query = forParam === 'campaign' ? { where: [['status', '==', 'active']] } : {};

        // A record without deleted_at is not deleted; Firestore's `== null` would skip it.
        const retailers = (await retailerRepository.findAll(query))
            .filter(retailer => !retailer.deleted_at);
        res.json(retailers);
    } catch (error) {
        logger.error('Failed to fetch retailers:', error);
        res.status(500).json({ error: 'Failed to fetch retailers' });
    }
});

/**
 * GET /api/retailers/:id
 * Get a single retailer by ID — any signed-in user can read.
 * S17-4: returns 404 if the retailer has been soft-deleted (deleted_at is set).
 */
router.get('/:id', authenticate, async (req, res) => {
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
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 */
router.post('/', authenticate, requireOrganizationManagement, async (req, res) => {
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
            id: req.body.id,
            name: name.trim(),
            contact_email: contact_email.trim(),
            contract_start: contract_start.trim(),
            logo: logo || '\uD83C\uDFEA',
            status: status && ['active', 'inactive'].includes(status) ? status : 'active'
        };

        const createdRetailer = await retailerRepository.createNew(retailerData);
        res.status(201).json(createdRetailer);
    } catch (error) {
        if (error.code === 6 || (error.message && error.message.includes('ALREADY_EXISTS'))) {
            return res.status(409).json({ error: 'Retailer already exists' });
        }
        logger.error('Failed to create retailer:', error);
        res.status(500).json({ error: 'Failed to create retailer' });
    }
});

/**
 * PUT /api/retailers/:id
 * Update a retailer.
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 */
router.put('/:id', authenticate, requireOrganizationManagement, async (req, res) => {
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
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 * S17-1: deleted_at field written to Firestore as canonical deletion marker.
 */
router.delete('/:id', authenticate, requireOrganizationManagement, async (req, res) => {
    try {
        // Always a soft delete (GUARDRAIL-15), whoever holds organizations.manage.
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
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 */
router.patch('/:id', authenticate, requireOrganizationManagement, async (req, res) => {
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
