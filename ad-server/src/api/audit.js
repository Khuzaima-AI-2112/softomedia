import express from 'express';
import { schedulingAuditRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireScreenDiagnostics } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * GET /api/audit
 * List audit entries, optionally filtered by locationId.
 */
router.get('/', async (req, res) => {
    try {
        const { locationId } = req.query;
        let audits;
        if (locationId) {
            audits = await schedulingAuditRepository.findByLocation(locationId);
        } else {
            audits = await schedulingAuditRepository.findAll();
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
