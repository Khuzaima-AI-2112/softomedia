import express from 'express';
import logger from '../utils/logger.js';
import {
    CREATIVE_STATUS,
    CreativeStatusConflictError,
    RetailerDecisionConflictError,
    campaignRepository,
    creativeRepository,
    mediaRepository,
    retailerRepository,
} from '../repositories/index.js';
import { brandIdFor, normalizeRole, retailerIdFor, ROLES } from '../constants/roles.js';
import { assetContentPath } from '../constants/mediaPaths.js';
import { PERMISSIONS, requireCreativeApproval, userHasPermission } from '../middleware/requireRole.js';
import {
    awaitsRetailer,
    notifyAfterNetworkApproval,
    notifyBrandOfRevocation,
    retailerApprovals,
} from '../services/CreativeApproval.js';
import { releaseLapsedReservations } from '../services/ReservationRelease.js';

const router = express.Router();
const NETWORK_ROLES = new Set([ROLES.ADMIN, ROLES.SUPERADMIN]);

const decidesForNetwork = user => userHasPermission(user, PERMISSIONS.CREATIVE_APPROVAL);
const decidesForRetailer = user => userHasPermission(user, PERMISSIONS.CREATIVE_APPROVAL_OWN)
    && Boolean(retailerIdFor(user));

/**
 * Who is looking at Creatives: which they see, which Retailers' decisions,
 * which Creatives wait on them, and which approvals they gave and may revoke.
 * The Super Administrator decides first; a Retailer then sees a Creative once
 * it waits on its decision.
 */
function viewerOf(user) {
    if (decidesForRetailer(user) && !decidesForNetwork(user)) {
        const retailerId = retailerIdFor(user);
        const awaits = (creative, campaigns) => awaitsRetailer(creative, retailerId, campaigns);
        return {
            retailerId,
            awaits,
            sees: (creative, campaigns) => Boolean(creative.retailer_approvals?.[retailerId])
                || awaits(creative, campaigns),
            revokes: creative => creative.retailer_approvals?.[retailerId]?.status === CREATIVE_STATUS.APPROVED,
        };
    }
    return {
        retailerId: null,
        awaits: creative => decidesForNetwork(user) && creative.approval_status === CREATIVE_STATUS.PENDING,
        sees: () => true,
        revokes: creative => decidesForNetwork(user) && creative.approval_status === CREATIVE_STATUS.APPROVED,
    };
}

/** What presenting a Creative needs to know besides the Creative. */
async function presentationContext(user) {
    const [campaigns, retailers] = await Promise.all([campaignRepository.findAll(), retailerRepository.findAll()]);
    return {
        campaigns,
        retailerNames: new Map(retailers.map(retailer => [retailer.id, retailer.name])),
        viewer: viewerOf(user),
    };
}

/**
 * A Creative with its files in order, each addressed by its API content path,
 * and each Retailer's decision the viewer may see.
 */
async function presentCreative(creative, { campaigns, retailerNames, viewer }) {
    const files = await Promise.all((creative.media_ids || []).map(async id => {
        const asset = await mediaRepository.findById(id);
        return { id, title: asset?.title ?? null, mime_type: asset?.mime_type ?? null, content_path: assetContentPath(id) };
    }));
    const approvals = retailerApprovals(creative, campaigns)
        .filter(approval => !viewer.retailerId || approval.retailer_id === viewer.retailerId)
        .map(approval => ({ ...approval, retailer_name: retailerNames.get(approval.retailer_id) ?? null }))
        .sort((a, b) => (a.retailer_name ?? a.retailer_id).localeCompare(b.retailer_name ?? b.retailer_id));
    return {
        ...creative,
        files,
        retailer_approvals: approvals,
        awaits_your_decision: viewer.awaits(creative, campaigns),
        revocable_by_you: viewer.revokes(creative),
    };
}

/**
 * GET /api/creatives
 * A Brand sees its own Creatives and each approval; Admin and Super
 * Administrator see the network's; a Retailer Administrator sees those booked
 * in its Stores once the Super Administrator has approved them.
 */
router.get('/', async (req, res) => {
    const role = normalizeRole(req.user?.role);
    if (role !== ROLES.BRAND && !NETWORK_ROLES.has(role) && !decidesForRetailer(req.user)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const brandId = brandIdFor(req.user);
        const context = await presentationContext(req.user);
        const creatives = role !== ROLES.BRAND
            ? await creativeRepository.findAll()
            : brandId ? await creativeRepository.findForBrand(brandId) : [];
        const visible = creatives.filter(creative => context.viewer.sees(creative, context.campaigns));
        return res.json(await Promise.all(visible.map(creative => presentCreative(creative, context))));
    } catch (error) {
        logger.error('[Creatives] Listing failed', { error: error.message });
        return res.status(500).json({ error: 'Creatives could not be loaded' });
    }
});

// Each Super Administrator decision moves a Creative from one status to the next.
const DECISIONS = {
    approve: { from: CREATIVE_STATUS.PENDING, to: CREATIVE_STATUS.APPROVED },
    reject: { from: CREATIVE_STATUS.PENDING, to: CREATIVE_STATUS.REJECTED, reasonRequired: true },
    revoke: { from: CREATIVE_STATUS.APPROVED, to: CREATIVE_STATUS.REVOKED },
};

/** Either approver approves, rejects, and revokes the approval it gave (ADR 0007, #38). */
function requireCreativeDecision(req, res, next) {
    if (decidesForRetailer(req.user) && !decidesForNetwork(req.user)) return next();
    return requireCreativeApproval(req, res, next);
}

/**
 * A Retailer's approval or rejection of a Creative booked in its Stores, for
 * those Stores, or its revocation of the approval it gave.
 */
async function decideForRetailer(req, res, { to }, reason) {
    const retailerId = retailerIdFor(req.user);
    const context = await presentationContext(req.user);
    const creative = await creativeRepository.findById(req.params.id);
    const booked = creative && retailerApprovals(creative, context.campaigns)
        .some(approval => approval.retailer_id === retailerId);
    if (!booked) return res.status(404).json({ error: 'Creative not found' });

    try {
        const decision = {
            status: to,
            decided_by: req.user.uid || req.user.id,
            decided_at: new Date().toISOString(),
            reason: reason || null,
        };
        const decided = to === CREATIVE_STATUS.REVOKED
            ? await creativeRepository.revokeForRetailer(creative.id, retailerId, decision)
            : await creativeRepository.decideForRetailer(creative.id, retailerId, decision);
        if (!decided) return res.status(404).json({ error: 'Creative not found' });
        if (to === CREATIVE_STATUS.REVOKED) {
            const retailerName = context.retailerNames.get(retailerId) || 'the Retailer';
            await notifyBrandOfRevocation(decided, `${retailerName} for its Stores`, decision.reason);
        }
        return res.json(await presentCreative(decided, context));
    } catch (error) {
        if (error instanceof RetailerDecisionConflictError) return res.status(409).json({ error: error.message });
        throw error;
    }
}

/**
 * POST /api/creatives/:id/approve | reject | revoke
 * The Super Administrator decides for the whole network; a Retailer
 * Administrator then approves or rejects for its own Stores (ADR 0007).
 */
for (const [action, decision] of Object.entries(DECISIONS)) {
    const { from, to, reasonRequired } = decision;
    router.post(`/:id/${action}`, requireCreativeDecision, async (req, res) => {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (reasonRequired && !reason) return res.status(400).json({ error: 'A reason is required' });

        try {
            // Deadlines already passed are settled first: a late approval never keeps a lapsed Slot,
            // and a revocation never releases one the Creative was approved for at its deadline.
            if (to !== CREATIVE_STATUS.REJECTED) await releaseLapsedReservations(req.params.id);
            if (!decidesForNetwork(req.user)) return await decideForRetailer(req, res, decision, reason);
            const decided = await creativeRepository.decide(req.params.id, from, {
                approval_status: to,
                decided_by: req.user.uid || req.user.id,
                decided_at: new Date().toISOString(),
                reason: reason || null,
            });
            if (!decided) return res.status(404).json({ error: 'Creative not found' });
            if (to === CREATIVE_STATUS.APPROVED) await notifyAfterNetworkApproval(decided);
            if (to === CREATIVE_STATUS.REVOKED) await notifyBrandOfRevocation(decided, 'the Super Administrator', reason);
            return res.json(await presentCreative(decided, await presentationContext(req.user)));
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
