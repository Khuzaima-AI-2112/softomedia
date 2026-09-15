/**
 * schedules.js
 * Express router — /api/schedules
 *
 * TODO: POST /api/schedules is a stub that saves nothing (issue #16).
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, requirePermission } from '../middleware/requireRole.js';

const router = express.Router();

/**
 * POST /api/schedules
 * Create a schedule override. Stub: returns the request without saving it.
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.SCHEDULE_OVERRIDE), (req, res) => {
    const id = `sched_${Date.now()}`;
    res.status(201).json({ id, ...req.body });
});

export default router;
