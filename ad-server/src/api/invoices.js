// Invoices API Routes
// Invoice generation and access for completed ad campaigns
// Sprint 15

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { campaignRepository } from '../repositories/CampaignRepository.js';
import PricingRepository from '../repositories/PricingRepository.js';
import { BaseRepository } from '../repositories/BaseRepository.js';
import { PERMISSIONS, requirePermission, userHasPermission } from '../middleware/requireRole.js';

const router = express.Router();

/** Admin and Super Administrator read every invoice; a Brand reads its own. */
const seesAllInvoices = user => userHasPermission(user, PERMISSIONS.INVOICE_VIEW_NETWORK);

function requireInvoiceRead(req, res, next) {
    if (seesAllInvoices(req.user) || userHasPermission(req.user, PERMISSIONS.INVOICE_VIEW_OWN)) return next();
    return res.status(403).json({ error: 'Access denied' });
}

// Invoice collection repository
class InvoiceRepository extends BaseRepository {
    constructor() {
        super('invoices');
    }
}
const invoiceRepository = new InvoiceRepository();

/**
 * POST /api/invoices/generate
 * Generate an invoice for a completed campaign.
 * Admin only.
 */
router.post('/generate', requirePermission(PERMISSIONS.INVOICE_GENERATE), async (req, res) => {
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
            return res.status(400).json({ error: 'Campaign must be completed' });
        }

        // Fetch CPM rate from pricing config
        let cpmRate = 15.00; // safe default
        try {
            const pricingConfig = await PricingRepository.getConfig();
            const screenType = campaign.screen_type || 'default';
            cpmRate = pricingConfig?.cpm_rates?.[screenType]
                   ?? pricingConfig?.baseCPM
                   ?? 15.00;
        } catch {
            // Use default rate if pricing config unavailable
        }

        const impressionsDelivered = campaign.impressionsDelivered ?? campaign.impressions_delivered ?? 0;
        const amount = parseFloat((impressionsDelivered * cpmRate / 1000).toFixed(4));
        const invoiceId = uuidv4();

        const invoice = await invoiceRepository.create(invoiceId, {
            invoiceId,
            campaignId,
            advertiserId: campaign.advertiser_id,
            impressionsDelivered,
            cpmRate,
            amount,
            generatedAt: new Date().toISOString(),
            generatedBy: req.user?.id ?? req.user?.email ?? 'system',
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
 * - admin/superadmin: all invoices, paginated
 * - advertiser: own invoices only (scoped to linked_entity_id)
 */
router.get('/', requireInvoiceRead, async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);

        let invoices;
        if (seesAllInvoices(req.user)) {
            invoices = await invoiceRepository.findAll({ limit });
        } else {
            const advertiserId = req.user?.linked_entity_id;
            if (!advertiserId) {
                return res.status(403).json({ error: 'Advertiser account not linked' });
            }
            invoices = await invoiceRepository.findAll({
                where: [['advertiserId', '==', advertiserId]],
                limit,
            });
        }

        return res.json({ invoices, total: invoices.length, page });
    } catch (error) {
        console.error('Failed to list invoices:', error);
        res.status(500).json({ error: 'Failed to list invoices' });
    }
});

/**
 * GET /api/invoices/:id
 * Get a single invoice.
 * Advertisers may only access their own invoices.
 */
router.get('/:id', requireInvoiceRead, async (req, res) => {
    try {
        const invoice = await invoiceRepository.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        if (!seesAllInvoices(req.user)) {
            const advertiserId = req.user?.linked_entity_id;
            if (invoice.advertiserId !== advertiserId) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        return res.json(invoice);
    } catch (error) {
        console.error('Failed to fetch invoice:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

/**
 * GET /api/invoices/:id/pdf
 * Return invoice data for PDF rendering.
 * Real PDF generation deferred post-MVP.
 * Advertisers may only access their own invoices.
 */
router.get('/:id/pdf', requireInvoiceRead, async (req, res) => {
    try {
        const invoice = await invoiceRepository.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        if (!seesAllInvoices(req.user)) {
            const advertiserId = req.user?.linked_entity_id;
            if (invoice.advertiserId !== advertiserId) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        return res.json({
            message: 'PDF generation not yet available',
            invoiceData: invoice,
        });
    } catch (error) {
        console.error('Failed to fetch invoice PDF data:', error);
        res.status(500).json({ error: 'Failed to fetch invoice PDF data' });
    }
});

export default router;
