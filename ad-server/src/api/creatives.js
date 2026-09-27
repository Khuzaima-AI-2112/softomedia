import express from 'express';
import logger from '../utils/logger.js';
import {
    CREATIVE_STATUS,
    CreativeStatusConflictError,
    creativeRepository,
    mediaRepository,
} from '../repositories/index.js';
import { brandIdFor, normalizeRole, ROLES } from '../constants/roles.js';
import { assetContentPath } from '../constants/mediaPaths.js';
import { requireCreativeApproval } from '../middleware/requireRole.js';

const router = express.Router();
const NETWORK_ROLES = new Set([ROLES.ADMIN, ROLES.SUPERADMIN]);

/** A Creative with its files in order, each addressed by its API content path. */
async function presentCreative(creative) {
    const files = await Promise.all((creative.media_ids || []).map(async id => {
        const asset = await mediaRepository.findById(id);
        return { id, title: asset?.title ?? null, content_path: assetContentPath(id) };
    }));
    return { ...creative, files };
}

/**
 * GET /api/creatives
 * A Brand sees its own Creatives and their approval status; Admin and Super
 * Administrator see the network's.
 */
router.get('/', async (req, res) => {
    const role = normalizeRole(req.user?.role);
    if (role !== ROLES.BRAND && !NETWORK_ROLES.has(role)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const brandId = brandIdFor(req.user);
        const creatives = role !== ROLES.BRAND
            ? await creativeRepository.findAll()
            : brandId ? await creativeRepository.findForBrand(brandId) : [];
        return res.json(await Promise.all(creatives.map(presentCreative)));
    } catch (error) {
        logger.error('[Creatives] Listing failed', { error: error.message });
        return res.status(500).json({ error: 'Creatives could not be loaded' });
    }
});

// Each decision moves a Creative from one status to the next.
const DECISIONS = {
    approve: { from: CREATIVE_STATUS.PENDING, to: CREATIVE_STATUS.APPROVED },
    reject: { from: CREATIVE_STATUS.PENDING, to: CREATIVE_STATUS.REJECTED, reasonRequired: true },
    revoke: { from: CREATIVE_STATUS.APPROVED, to: CREATIVE_STATUS.REVOKED },
};

/**
 * POST /api/creatives/:id/approve | reject | revoke
 * One grant covers all three, so who approves is changed in a single place.
 */
for (const [action, { from, to, reasonRequired }] of Object.entries(DECISIONS)) {
    router.post(`/:id/${action}`, requireCreativeApproval, async (req, res) => {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (reasonRequired && !reason) return res.status(400).json({ error: 'A reason is required' });

        try {
            const decided = await creativeRepository.decide(req.params.id, from, {
                approval_status: to,
                decided_by: req.user.uid || req.user.id,
                decided_at: new Date().toISOString(),
                reason: reason || null,
            });
            if (!decided) return res.status(404).json({ error: 'Creative not found' });
            return res.json(await presentCreative(decided));
        } catch (error) {
            if (error instanceof CreativeStatusConflictError) {
                return res.status(409).json({ error: `Only a ${from} Creative can be ${to}` });
            }
            logger.error('[Creatives] Decision failed', { action, creativeId: req.params.id, error: error.message });
            return res.status(500).json({ error: 'The decision could not be saved' });
        }
    });
}

export default router;
