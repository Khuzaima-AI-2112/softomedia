// Daypart delivery report (#41): Proof of Play by Campaign or promotion and by Daypart.
// Admin and Super Administrator see the network; a Brand its own Campaigns;
// a Retailer Administrator its own Stores.

import express from 'express';
import {
    campaignRepository,
    daypartRepository,
    impressionRepository,
    loopRepository,
    StoreRepository,
} from '../repositories/index.js';
import { PERMISSIONS, normalizeRole, userHasPermission } from '../middleware/requireRole.js';
import { ROLES, brandIdFor } from '../constants/roles.js';
import { buildDeliveryReport } from '../services/DeliveryReport.js';
import logger from '../utils/logger.js';

const router = express.Router();

// As campaigns.js reads it: the Retailer a Retailer Administrator acts for.
const retailerIdFor = user => user?.organization_id || user?.linked_entity_id || null;

/** Whose delivery this user may see, or null. */
function reportScopeFor(user) {
    if (userHasPermission(user, PERMISSIONS.DELIVERY_REPORT_VIEW_NETWORK)) return { kind: 'network' };
    if (!userHasPermission(user, PERMISSIONS.DELIVERY_REPORT_VIEW_OWN)) return null;
    const role = normalizeRole(user.role);
    if (role === ROLES.BRAND && brandIdFor(user)) return { kind: 'brand', brandId: brandIdFor(user) };
    if (role === ROLES.RETAILERADMIN && retailerIdFor(user)) return { kind: 'retailer', retailerId: retailerIdFor(user) };
    return null;
}

/**
 * GET /api/delivery-report
 * { dayparts, columns, rows: [{ campaign_id, campaign_name, is_retailer_promotion, dayparts, total }], totals }
 */
router.get('/', async (req, res) => {
    const scope = reportScopeFor(req.user);
    if (!scope) return res.status(403).json({ error: 'Access denied' });

    try {
        const [proofs, loops, stores, campaigns, dayparts] = await Promise.all([
            impressionRepository.findAll({ where: [['playback_kind', '==', 'campaign_delivery']] }),
            loopRepository.findAll(),
            StoreRepository.findAll(),
            campaignRepository.findAll(),
            daypartRepository.get(),
        ]);
        return res.json({
            ...buildDeliveryReport({ proofs, loops, stores, campaigns, dayparts, scope }),
            generated_at: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Daypart delivery report failed', { error: error.message });
        return res.status(500).json({ error: 'Delivery report unavailable' });
    }
});

export default router;
