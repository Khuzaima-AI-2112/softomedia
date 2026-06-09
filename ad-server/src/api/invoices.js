// Invoices API Routes
// Invoice generation and access for completed campaigns

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import PricingRepository from '../repositories/PricingRepository.js';
import { BaseRepository } from '../repositories/BaseRepository.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();
const invoiceRepository = new BaseRepository('invoices');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns true if the requesting user is allowed to see this invoice.
 * Admins / superadmins see all. Advertisers see only their own.
 */
function canAccessInvoice(user, invoice) {
    if (user.role === 'admin' || user.role === 'superadmin') return true;
    return invoice.advertiser_id === (user.linked_entity_id ?? user.id);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/invoices/generate
 * Generate an invoice for a completed campaign — admin only
 * Body: { campaignId: string }
 */
router.post('/generate', authorize(['admin', 'superadmin']), async (req, res) => {
    try {
        const { campaignId } = req.body;

        if (!campaignId) {
            return res.status(400).json({ error: 'campaignId is required' });
        }

        const campaign = await campaignRepository.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (campaign.status !== 'completed') {
            return res.status(400).json({ error: 'Campaign must be completed before an invoice can be generated' });
        }

        // Resolve CPM rate from pricing config, fall back to baseCPM
        let cpmRate = 15.00;
        try {
            const pricingConfig = await PricingRepository.getConfig();
            cpmRate = pricingConfig?.baseCPM ?? pricingConfig?.base_cpm ?? 15.00;
        } catch {
            // Use default if pricing config unavailable
        }

        const impressionsDelivered = campaign.impressionsDelivered ?? campaign.impressions_delivered ?? 0;
        const amount = parseFloat(((impressionsDelivered * cpmRate) / 1000).toFixed(4));

        const invoiceId = uuidv4();
        const invoice = await invoiceRepository.create(invoiceId, {
            invoiceId,
            campaignId,
            advertiser_id:        campaign.advertiser_id,
            campaignName:         campaign.name ?? campaignId,
            impressionsDelivered,
            cpmRate,
            amount,
            currency:             'USD',
            generatedAt:          new Date().toISOString(),
            generatedBy:          req.user.id ?? req.user.email,
        });

        return res.status(201).json(invoice);
    } catch (error) {
        console.error('Failed to generate invoice:', error);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
});

/**
 * GET /api/invoices
 * List invoices.
 * Advertisers see only their own; admins see all.
 * Query params: page (default 1), limit (default 20)
 */
router.get('/', async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

        const where = isAdmin
            ? []
            : [['advertiser_id', '==', req.user.linked_entity_id ?? req.user.id]];

        const all      = await invoiceRepository.findAll({ where });
        const total    = all.length;
        const invoices = all.slice((page - 1) * limit, page * limit);

        res.json({ invoices, total, page, limit });
    } catch (error) {
        console.error('Failed to list invoices:', error);
        res.status(500).json({ error: 'Failed to list invoices' });
    }
});

/**
 * GET /api/invoices/:id
 * Get a single invoice by ID.
 * Advertisers may only access their own invoices (SEC-S15-1).
 */
router.get('/:id', async (req, res) => {
    try {
        const invoice = await invoiceRepository.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        if (!canAccessInvoice(req.user, invoice)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(invoice);
    } catch (error) {
        console.error('Failed to fetch invoice:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

/**
 * GET /api/invoices/:id/pdf
 * PDF generation stub — returns invoice data as JSON.
 * Real PDF rendering deferred to post-MVP.
 */
router.get('/:id/pdf', async (req, res) => {
    try {
        const invoice = await invoiceRepository.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        if (!canAccessInvoice(req.user, invoice)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({
            message: 'PDF generation not yet available',
            invoiceData: invoice,
        });
    } catch (error) {
        console.error('Failed to fetch invoice PDF:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

export default router;
