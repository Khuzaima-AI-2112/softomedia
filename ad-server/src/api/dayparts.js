// Dayparts API: the network's breakfast, lunch and dinner hours.
// Every signed-in role reads them; only the Super Administrator sets them.

import express from 'express';
import { daypartRepository, platformAuditRepository } from '../repositories/index.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatformGovernance } from '../middleware/requireRole.js';
import { daypartsError } from '../services/Dayparts.js';

const router = express.Router();

/**
 * GET /api/dayparts
 * The network's Dayparts, or the defaults until they are set.
 */
router.get('/', authenticate, async (_req, res) => {
    try {
        res.json(await daypartRepository.get());
    } catch {
        res.status(500).json({ error: 'Failed to fetch Dayparts' });
    }
});

/**
 * PUT /api/dayparts
 * Set breakfast, lunch and dinner for the whole network — Super Administrator only.
 * Body: { breakfast: { start, end }, lunch: {...}, dinner: {...} } in whole hours, end exclusive.
 */
router.put('/', authenticate, requirePlatformGovernance, async (req, res) => {
    const error = daypartsError(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const dayparts = await daypartRepository.save(req.body);
        await platformAuditRepository.record({
            action: 'dayparts_updated',
            actor_id: req.user.id || req.user.uid,
            actor_role: req.user.role,
            changes: dayparts,
        });
        res.json(dayparts);
    } catch {
        res.status(500).json({ error: 'Failed to save Dayparts' });
    }
});

export default router;
