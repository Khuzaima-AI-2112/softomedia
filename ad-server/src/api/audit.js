/**
 * audit.js — Sprint 10
 *
 * Admin-only audit log viewer.
 * Reads from the `audit_logs` Firestore collection.
 *
 * GET /api/audit
 *   Query params:
 *     action        — filter by action string (e.g. 'campaign.created')
 *     actor_id      — filter by user who performed the action
 *     entity_type   — filter by entity (e.g. 'campaign', 'screen', 'user')
 *     entity_id     — filter by specific entity ID
 *     from / to     — ISO date range
 *     limit         — page size (default 50, max 100)
 *     after         — cursor (last doc ID from previous page)
 *
 * POST /api/audit (internal use — write an audit event)
 *   Body: { action, entity_type, entity_id, details? }
 */

import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const COLLECTION = 'audit_logs';

function db() { return getFirestore(); }

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const {
            action, actor_id, entity_type, entity_id,
            from, to,
            limit = '50', after,
        } = req.query;

        const pageSize = Math.min(parseInt(limit) || 50, 100);

        let q = db().collection(COLLECTION).orderBy('timestamp', 'desc');

        if (action)      q = q.where('action',      '==', action);
        if (actor_id)    q = q.where('actor_id',    '==', actor_id);
        if (entity_type) q = q.where('entity_type', '==', entity_type);
        if (entity_id)   q = q.where('entity_id',   '==', entity_id);
        if (from)        q = q.where('timestamp', '>=', new Date(from));
        if (to)          q = q.where('timestamp', '<=', new Date(to));

        q = q.limit(pageSize + 1);

        if (after) {
            const cursorDoc = await db().collection(COLLECTION).doc(after).get();
            if (cursorDoc.exists) q = q.startAfter(cursorDoc);
        }

        const snap    = await q.get();
        const docs    = snap.docs.slice(0, pageSize);
        const hasMore = snap.docs.length > pageSize;

        res.json({
            logs: docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate?.()?.toISOString?.() ?? d.data().timestamp,
            })),
            hasMore,
            nextCursor: hasMore ? docs[docs.length - 1].id : null,
            total: docs.length,
        });
    } catch (error) {
        logger.error('Audit log fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// ── POST / (internal write helper) ───────────────────────────────────────────
/**
 * writeAuditLog — call from other route handlers to record an event.
 * Usage:
 *   import { writeAuditLog } from './audit.js';
 *   await writeAuditLog(req.user, 'campaign.created', 'campaign', campaign.id, { name });
 */
export async function writeAuditLog(actor, action, entity_type, entity_id, details = {}) {
    try {
        await db().collection(COLLECTION).add({
            actor_id:    actor?.uid || 'system',
            actor_email: actor?.email || null,
            actor_role:  actor?.role || null,
            action,
            entity_type,
            entity_id:   entity_id || null,
            details,
            timestamp:   FieldValue.serverTimestamp(),
        });
    } catch (err) {
        logger.warn('writeAuditLog failed (non-fatal):', err.message);
    }
}

// ── POST /write (authenticated admin shortcut) ────────────────────────────────
router.post('/write', requireAuth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required.' });
        }
        const { action, entity_type, entity_id, details } = req.body;
        if (!action || !entity_type) {
            return res.status(400).json({ error: 'action and entity_type are required.' });
        }
        await writeAuditLog(req.user, action, entity_type, entity_id, details || {});
        res.status(201).json({ message: 'Audit log written.' });
    } catch (error) {
        logger.error('Audit write error:', error);
        res.status(500).json({ error: 'Failed to write audit log' });
    }
});

export default router;
