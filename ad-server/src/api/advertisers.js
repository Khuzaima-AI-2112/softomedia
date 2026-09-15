import express from 'express';
import { advertiserRepository } from '../repositories/AdvertiserRepository.js';
import logger from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { requireOrganizationManagement } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * GET /api/advertisers
 * List all non-deleted advertisers — any signed-in user can read.
 * S17-3: soft-deleted advertisers (deleted_at set) are excluded.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        // A record without deleted_at is not deleted; Firestore's `== null` would skip it.
        const advertisers = (await advertiserRepository.findAll())
            .filter(advertiser => !advertiser.deleted_at);
        res.json(advertisers);
    } catch (error) {
        logger.error('Failed to fetch advertisers:', error);
        res.status(500).json({ error: 'Failed to fetch advertisers' });
    }
});

/**
 * GET /api/advertisers/:id
 * Get a single advertiser by ID — any signed-in user can read.
 * S17-4: returns 404 if the advertiser has been soft-deleted (deleted_at is set).
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const advertiser = await advertiserRepository.findById(req.params.id);
        if (!advertiser || advertiser.deleted_at) {
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
 * Create a new advertiser.
 * Required fields: name, logo, industry, contactemail, budget, status
 * Document ID is prefixed with 'adv_'
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 */
router.post('/', authenticate, requireOrganizationManagement, async (req, res) => {
    try {
        const { name, logo, industry, contactemail, budget, status } = req.body;

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

        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const docId = req.body.id || `adv_${timestamp}_${random}`;

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
        if (error.code === 6 || (error.message && error.message.includes('ALREADY_EXISTS'))) {
            return res.status(409).json({ error: 'Advertiser already exists' });
        }
        logger.error('Failed to create advertiser:', error);
        res.status(500).json({ error: 'Failed to create advertiser' });
    }
});

/**
 * PUT /api/advertisers/:id
 * Full update an advertiser (replaces all fields).
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 */
router.put('/:id', authenticate, requireOrganizationManagement, async (req, res) => {
    try {
        const advertiser = await advertiserRepository.update(req.params.id, req.body);
        res.json(advertiser);
    } catch (error) {
        logger.error('Failed to update advertiser:', error);
        res.status(500).json({ error: 'Failed to update advertiser' });
    }
});

/**
 * PATCH /api/advertisers/:id
 * Partial update — only overwrites supplied fields.
 * Used for field-level edits (name, logo, industry, contactemail, budget)
 * and active/inactive status toggles.
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 * S21-2 (SEC-S21-1): explicit field allowlist added. deleted_at is owned
 * exclusively by softDelete() and cannot be overwritten via PATCH —
 * GUARDRAIL-15.
 * Phase 1: organizations.manage (Super Administrator) guards all retailer
 * and advertiser mutation routes, superseding the S21-3 admin decision.
 * S21-3: 'status' added to allowlist for active/inactive toggles —
 * mirrors the retailers PATCH pattern. 'suspended' is reserved for
 * softDelete() exclusively and is rejected with 400 if sent here.
 * A PATCH body containing only non-allowlisted fields returns 400.
 */
router.patch('/:id', authenticate, requireOrganizationManagement, async (req, res) => {
    try {
        // Allowlist: only non-sensitive business fields are patchable.
        // deleted_at  — owned exclusively by softDelete(); blocked per GUARDRAIL-15.
        // status      — active/inactive toggle allowed; 'suspended' rejected below
        //               (reserved for softDelete() only).
        const ALLOWED_PATCH_FIELDS = ['name', 'logo', 'industry', 'contactemail', 'budget', 'status'];
        const patch = {};
        for (const field of ALLOWED_PATCH_FIELDS) {
            if (req.body[field] !== undefined) patch[field] = req.body[field];
        }
        // Guard: 'suspended' is softDelete() territory — cannot be set via PATCH.
        if (patch.status !== undefined && !['active', 'inactive'].includes(patch.status)) {
            return res.status(400).json({ error: 'Status must be one of: active, inactive' });
        }
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: 'No patchable fields provided' });
        }
        const advertiser = await advertiserRepository.update(req.params.id, patch);
        res.json(advertiser);
    } catch (error) {
        logger.error('Failed to patch advertiser:', error);
        res.status(500).json({ error: 'Failed to patch advertiser' });
    }
});

/**
 * DELETE /api/advertisers/:id
 * Soft-delete: sets status to 'suspended' and stamps deleted_at.
 * Preserves referential integrity with campaigns that reference advertiser_id.
 * Record is excluded from GET / list after this operation.
 *
 * Sprint 11 — S11-1: authenticate + requireRole('admin') guard added; Phase 1: Super Administrator only.
 * S17-2: deleted_at field written to Firestore as canonical deletion marker.
 */
router.delete('/:id', authenticate, requireOrganizationManagement, async (req, res) => {
    try {
        // Always a soft delete (GUARDRAIL-15), whoever holds organizations.manage.
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
