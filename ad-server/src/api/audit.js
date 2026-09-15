import express from 'express';
import {
    StoreRepository,
    loopRepository,
    schedulingAuditRepository,
    screenRepository,
} from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, requireScreenDiagnostics, userHasPermission } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * The Retailer an audit entry belongs to, through the loop, Store or Screen it
 * names. An entry that names none belongs to no Retailer.
 */
async function retailerOfEntry(entry, lookups) {
    const lookup = (repository, id) => {
        if (!id) return null;
        const key = `${repository.collectionName}:${id}`;
        if (!lookups.has(key)) lookups.set(key, repository.findById(id).catch(() => null));
        return lookups.get(key);
    };
    if (entry.retailer_id) return entry.retailer_id;
    const [store, loop, screen] = await Promise.all([
        lookup(StoreRepository, entry.store_id),
        lookup(loopRepository, entry.parent_loop_id || entry.entity_id),
        lookup(screenRepository, entry.screen_id),
    ]);
    return store?.retailer_id || loop?.retailer_id || screen?.retailer_id || null;
}

async function withinRetailer(audits, retailerId) {
    if (!retailerId) return [];
    const lookups = new Map();
    const owners = await Promise.all(audits.map(entry => retailerOfEntry(entry, lookups)));
    return audits.filter((_, index) => owners[index] === retailerId);
}

/** Super Administrator and Technical Operator read the whole log; a Retailer reads its own. */
function requireAuditRead(req, res, next) {
    if (userHasPermission(req.user, PERMISSIONS.AUDIT_VIEW_NETWORK)
        || userHasPermission(req.user, PERMISSIONS.AUDIT_VIEW_OWN)) {
        return next();
    }
    return res.status(403).json({ error: 'Access denied' });
}

/**
 * GET /api/audit
 * List audit entries, optionally filtered by locationId.
 */
router.get('/', authenticate, requireAuditRead, async (req, res) => {
    try {
        const { locationId } = req.query;
        let audits;
        if (locationId) {
            audits = await schedulingAuditRepository.findByLocation(locationId);
        } else {
            audits = await schedulingAuditRepository.findAll();
        }
        if (!userHasPermission(req.user, PERMISSIONS.AUDIT_VIEW_NETWORK)) {
            audits = await withinRetailer(audits, req.user.organization_id || req.user.linked_entity_id);
        }
        res.json(audits);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/audit
 * Write a new audit log entry.
 *
 * Sprint 13 — S13-2: confirms the endpoint that TechOpsDashboard fires
 * fire-and-forget after every screen restart (Task 4.3).
 *
 * Body:
 *   - action     {string} REQUIRED  e.g. 'screen_restart'
 *   - screen_id  {string} optional
 *   - user_id    {string} optional  falls back to req.user.uid
 *   - outcome    {string} optional  'success' | 'failure'
 *   - timestamp  {string} optional  ISO-8601; defaults to server time
 *   - [any other metadata fields are forwarded as-is]
 *
 * Returns 201 { id, ...entry } on success.
 * Returns 400 if action is missing.
 */
router.post('/', authenticate, requireScreenDiagnostics, async (req, res) => {
    try {
        const { action, screen_id, user_id, outcome, timestamp, ...rest } = req.body;
        if (!action) {
            return res.status(400).json({ error: 'action is required' });
        }
        const entry = await schedulingAuditRepository.logAction(action, {
            screen_id:  screen_id  || null,
            user_id:    user_id    || req.user?.uid || 'unknown',
            outcome:    outcome    || null,
            timestamp:  timestamp  || new Date().toISOString(),
            ...rest,
        });
        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
