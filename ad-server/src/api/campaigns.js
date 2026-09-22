import express from 'express';
import {
    campaignRepository,
    impressionRepository,
    locationRepository,
    mediaRepository,
    retailerRepository,
    screenRepository,
    StoreRepository,
} from '../repositories/index.js';
import { campaignService } from '../services/CampaignService.js';
import { resolveAgreedCpm } from '../services/CampaignPricingService.js';
import { authenticate } from '../middleware/auth.js';
import {
    PERMISSIONS,
    requireCampaignApproval,
    requirePermission,
    userHasPermission,
} from '../middleware/requireRole.js';
import { ROLES, normalizeRole } from '../constants/roles.js';

const router = express.Router();

function isBrand(user) {
    return normalizeRole(user?.role) === ROLES.BRAND;
}

function brandIdFor(user) {
    return user?.linked_entity_id || user?.organization_id || null;
}

function isRetailer(user) {
    return normalizeRole(user?.role) === ROLES.RETAILERADMIN;
}

function retailerIdFor(user) {
    return user?.organization_id || user?.linked_entity_id || null;
}

/** Campaign records are read by those who create them or approve them, within their scope. */
function requireCampaignRead(req, res, next) {
    if (userHasPermission(req.user, PERMISSIONS.CAMPAIGN_CREATE)
        || userHasPermission(req.user, PERMISSIONS.CAMPAIGN_APPROVAL)) {
        return next();
    }
    return res.status(403).json({ error: 'Access denied' });
}

/** A Retailer reviews content, not a Brand's finances. */
const BUDGET_FIELDS = new Set(['budget', 'budget_total']);

function withoutBudget(campaign) {
    return Object.fromEntries(Object.entries(campaign).filter(([field]) => !BUDGET_FIELDS.has(field)));
}

function denyBrandAccess(res) {
    return res.status(403).json({ error: 'Forbidden' });
}

async function validateBrandSubmission(body, ownerId) {
    if (!body.media_id) {
        return { error: 'A persisted paid creative is required', status: 400 };
    }
    const media = await mediaRepository.findById(body.media_id);
    if (!media || media.category !== 'paid' || media.owner_type !== 'brand' || media.owner_id !== ownerId) {
        return { error: 'The selected creative is unavailable', status: 403 };
    }

    if (!Array.isArray(body.inventory_selection) || body.inventory_selection.length === 0) {
        return { error: 'At least one Bookable Inventory selection is required', status: 400 };
    }

    for (const selection of body.inventory_selection) {
        const [retailer, store, location, screen] = await Promise.all([
            retailerRepository.findById(selection.retailer_id),
            StoreRepository.findById(selection.store_id),
            locationRepository.findById(selection.location_id),
            screenRepository.findById(selection.screen_id),
        ]);
        const valid = retailer
            && retailer.status === 'active'
            && !retailer.deleted_at
            && store
            && store.status !== 'inactive'
            && !store.deleted_at
            && location
            && location.status !== 'inactive'
            && !location.deleted_at
            && screen
            && screen.status !== 'inactive'
            && !screen.deleted_at
            && store.retailer_id === selection.retailer_id
            && location.store_id === store.id
            && location.retailer_id === selection.retailer_id
            && screen.store_id === store.id
            && screen.location_id === location.id
            && screen.retailer_id === selection.retailer_id
            && screen.bookable !== false;
        if (!valid) return { error: 'The selected Bookable Inventory is unavailable', status: 400 };
    }

    return { media };
}

/**
 * VALID_TRANSITIONS — ordered state machine for campaign status.
 *
 * Sprint 14 — S14-2: replaces the flat ALLOWED_STATUSES array.
 * Only transitions listed here are permitted; all others return 400.
 *
 * pending_approval → approved | rejected   (retaileradmin decision)
 * approved         → live                  (ops go-live)
 * live             → completed | paused    (ops or scheduler)
 * paused           → live                  (ops resume)
 * completed        → (terminal)
 * rejected         → (terminal)
 */
const VALID_TRANSITIONS = {
    pending_approval: ['approved', 'rejected'],
    approved: ['live', 'rejected'],
    live: ['completed', 'paused'],
    paused: ['live'],
    completed: [],
    rejected: [],
};


/**
 * GET /api/campaigns
 * List campaigns.
 *
 * A Brand sees its own Campaigns; a Retailer sees Campaigns for its Stores
 * without budgets. Admin and Super Administrator see every Campaign, filtered
 * by the optional ?status= or ?advertiserId= query params.
 */
router.get('/', authenticate, requireCampaignRead, async (req, res) => {
    try {
        const { status, advertiserId } = req.query;
        let campaigns;

        if (userHasPermission(req.user, PERMISSIONS.CAMPAIGN_VIEW_NETWORK)) {
            if (advertiserId) {
                campaigns = await campaignRepository.findAll({
                    where: [['advertiser_id', '==', advertiserId]]
                });
            } else if (status) {
                campaigns = await campaignRepository.findAll({
                    where: [['status', '==', status]]
                });
            } else {
                campaigns = await campaignRepository.findAll();
            }
        } else if (isRetailer(req.user)) {
            const retailerId = retailerIdFor(req.user);
            campaigns = (await campaignRepository.findAll())
                .filter(campaign => campaignRepository.targetsRetailer(campaign, retailerId)
                    && (!status || campaign.status === status))
                .map(withoutBudget);
        } else {
            // A Brand sees only its own Campaigns.
            campaigns = await campaignRepository.findByBrandId(
                brandIdFor(req.user),
                status?.toLowerCase(),
            );
        }

        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/campaigns/:id
 * Get a single campaign by ID.
 *
 * Sprint 14 — S14-2: advertiser callers receive 403 if the campaign's
 * advertiser_id does not match their linked_entity_id.
 */
router.get('/:id', authenticate, requireCampaignRead, async (req, res) => {
    try {
        const campaign = await campaignRepository.findById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (userHasPermission(req.user, PERMISSIONS.CAMPAIGN_VIEW_NETWORK)) {
            return res.json(campaign);
        }
        if (isRetailer(req.user)) {
            if (!campaignRepository.targetsRetailer(campaign, retailerIdFor(req.user))) {
                return res.status(404).json({ error: 'Campaign not found' });
            }
            return res.json(withoutBudget(campaign));
        }
        // A Brand reads only its own Campaigns.
        if (!campaignRepository.isOwnedByBrand(campaign, brandIdFor(req.user))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/campaigns
 * Create a new campaign (defaults to pending_approval).
 *
 * Requires campaigns.create: a Brand creates for its own organization; Admin
 * and Super Administrator create on behalf of a named advertiser.
 *
 * T1 fix: Admin and Super Administrator callers MUST supply advertiser_id
 *   in the request body — returns 400 if missing. Prevents orphaned
 *   campaigns with advertiser_id: null written to Firestore (Gap #1).
 *
 * T5 fix: a Brand's advertiser_id is stamped from its signed-in identity;
 *   any value in req.body is ignored to prevent spoofing.
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.CAMPAIGN_CREATE, ROLES.BRAND), async (req, res) => {
    try {
        // T1: Brands create for their own organization; Admin and Super
        // Administrator create on behalf of a named advertiser.
        const brandCaller = isBrand(req.user);
        const preparedForAdvertiser = !brandCaller;
        const brandOwnerId = brandIdFor(req.user);

        if (brandCaller && !brandOwnerId) {
            return res.status(403).json({ error: 'Brand account has no organization assignment' });
        }

        // T1: a Campaign prepared for an advertiser must name that advertiser
        if (preparedForAdvertiser && !req.body.advertiser_id) {
            return res.status(400).json({
                error: 'advertiser_id is required when creating a campaign as admin or superadmin',
            });
        }

        let brandMedia = null;
        if (brandCaller) {
            const validation = await validateBrandSubmission(req.body, brandOwnerId);
            if (validation.error) {
                return res.status(validation.status).json({ error: validation.error });
            }
            brandMedia = validation.media;
        }

        // Task 2A: Full-Capacity Inventory Blocking
        // Only enforce check if target dates and location are explicitly provided
        if (req.body.start_date && req.body.end_date && req.body.location_id) {
            const existingCampaigns = await campaignRepository.findAll({
                where: [
                    ['status', 'in', ['approved', 'live', 'pending_approval']],
                    ['location_id', '==', req.body.location_id]
                ]
            });
            const overlapping = existingCampaigns.filter(c => {
                const overlapsStart = req.body.start_date <= c.end_date;
                const overlapsEnd = req.body.end_date >= c.start_date;
                return overlapsStart && overlapsEnd;
            });

            if (overlapping.length >= 12) {
                return res.status(409).json({
                    error: 'INVENTORY_SOLD_OUT',
                    message: `Location ${req.body.location_id} is completely sold out for the requested date range. Maximum 12 concurrent campaigns reached.`
                });
            }
        }

        const id = brandCaller ? `cmp_${Date.now()}` : (req.body.id || `cmp_${Date.now()}`);
        const submittedData = brandCaller ? {
            name: req.body.name,
            media_id: req.body.media_id,
            creative_mime_type: brandMedia.mime_type,
            creative_duration: brandMedia.duration,
            start_date: req.body.start_date,
            end_date: req.body.end_date,
            budget: req.body.budget,
            inventory_selection: req.body.inventory_selection,
            selected_slots: Array.isArray(req.body.selected_slots) ? req.body.selected_slots : [],
        } : req.body;
        const bookedAt = new Date().toISOString();
        const campaignData = {
            ...submittedData,
            // T5: a Brand's ownership is stamped by createForBrand from its identity;
            // a Campaign prepared for an advertiser uses the advertiser named above.
            ...(preparedForAdvertiser ? { advertiser_id: req.body.advertiser_id } : {}),
            // The rate is struck now and billed later: re-tiering a Store never
            // re-prices a Campaign already booked against it.
            agreed_cpm: await resolveAgreedCpm(submittedData),
            agreed_cpm_at: bookedAt,
            // Every Campaign awaits Retailer approval; no administrative override.
            status: 'pending_approval',
            created_at: bookedAt
        };
        const campaign = brandCaller
            ? await campaignRepository.createForBrand(id, campaignData, brandOwnerId)
            : await campaignRepository.create(id, campaignData);
        res.status(201).json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/campaigns/:id/status
 * Transition campaign state.
 *
 * Sprint 8  — S8-3     : requireRole('retaileradmin') guard.
 * Sprint 8  — S8-4     : status normalised to lowercase before persisting.
 * Sprint 14 — S14-2    : flat ALLOWED_STATUSES replaced with VALID_TRANSITIONS
 *   state machine.
 *
 * fix: authenticate middleware was missing — req.user was never populated so
 *   requireRole resolved every caller to level -1 → 403.
 */
router.patch('/:id/status', authenticate, requireCampaignApproval, async (req, res) => {
    try {
        const { id } = req.params;
        const rawStatus = req.body.status;
        if (!rawStatus) return res.status(400).json({ error: 'Status is required' });

        const requestedStatus = typeof rawStatus === 'string'
            ? rawStatus.toLowerCase()
            : String(rawStatus);

        const campaign = await campaignRepository.findById(id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        // Retailers approve content only for their own Stores.
        if (!campaignRepository.targetsRetailer(campaign, retailerIdFor(req.user))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const currentStatus = campaign.status || 'pending_approval';
        const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

        // No administrative override: only the Retailer Administrator holds this grant.
        if (!allowed.includes(requestedStatus)) {
            return res.status(400).json({
                error: 'Invalid status transition',
                from: currentStatus,
                to: requestedStatus,
                allowed,
            });
        }

        const updated = await campaignService.updateStatus(id, requestedStatus);
        res.json(updated);
    } catch (error) {
        const statusCode = error.message === 'Campaign not found' ? 404 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

// A Retailer approved these Stores and this creative; changing either needs approval again.
const APPROVED_FIELDS = ['inventory_selection', 'retailer_id', 'store_id', 'media_id', 'asset_id'];
const ADMIN_EDITABLE_FIELDS = ['name', 'start_date', 'end_date', 'budget', ...APPROVED_FIELDS];

/**
 * PUT /api/campaigns/:id
 * Edits a campaign's editable fields. A Brand edits its name, dates and budget;
 * an Admin also edits its Stores and creative, which returns it to Retailer approval.
 */
router.put('/:id', authenticate, requirePermission(PERMISSIONS.CAMPAIGN_CREATE, null), async (req, res) => {
    try {
        // Status changes only through Retailer approval (PATCH /:id/status).
        if (req.body?.status !== undefined) {
            return res.status(400).json({ error: 'Campaign status cannot be edited; it changes through Retailer approval' });
        }
        const { id } = req.params;
        const campaign = await campaignRepository.findById(id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (isBrand(req.user) && !campaignRepository.isOwnedByBrand(campaign, brandIdFor(req.user))) {
            return denyBrandAccess(res);
        }
        const updateData = isBrand(req.user) ? {
            name: req.body.name ?? campaign.name,
            start_date: req.body.start_date ?? campaign.start_date,
            end_date: req.body.end_date ?? campaign.end_date,
            budget: req.body.budget ?? campaign.budget,
        } : Object.fromEntries(ADMIN_EDITABLE_FIELDS
            .filter(field => req.body?.[field] !== undefined)
            .map(field => [field, req.body[field]]));
        if (APPROVED_FIELDS.some(field => field in updateData
            && JSON.stringify(updateData[field]) !== JSON.stringify(campaign[field]))) {
            updateData.status = 'pending_approval';
        }
        const updated = await campaignRepository.update(id, updateData);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id/proofs-of-play', authenticate, async (req, res) => {
    try {
        const campaign = await campaignRepository.findById(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        const role = normalizeRole(req.user?.role);
        const canView = userHasPermission(req.user, PERMISSIONS.PROOF_OF_PLAY_VIEW_NETWORK)
            || (role === ROLES.BRAND && campaignRepository.isOwnedByBrand(campaign, brandIdFor(req.user)));
        if (!canView) return denyBrandAccess(res);
        const proofs = await impressionRepository.findProofsOfPlayByCampaign(campaign.id);
        return res.json(proofs);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/campaigns/:id
 *
 * Sprint 9  — Task 9.2: authenticate + requireRole guard added.
 * Sprint 11 — S11-3   : tightened to requireRole('superadmin').
 */
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.CAMPAIGN_DELETE, ROLES.SUPERADMIN), async (req, res) => {
    try {
        await campaignRepository.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
