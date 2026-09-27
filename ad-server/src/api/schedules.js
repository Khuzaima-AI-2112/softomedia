/**
 * schedules.js
 * Express router — /api/schedules
 *
 * A Retailer's weekly schedule overrides for its Stores (#16).
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, requirePermission } from '../middleware/requireRole.js';
import { findManagedStore } from '../middleware/storeManagement.js';
import { OVERRIDE_DAYS, scheduleOverrideRepository } from '../repositories/ScheduleOverrideRepository.js';

const router = express.Router();
const OVERRIDE_TYPES = Object.freeze(['blocked', 'forced']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

router.use(authenticate, requirePermission(PERMISSIONS.SCHEDULE_OVERRIDE));

function invalidOverride({ day, start, end, type }) {
    if (!OVERRIDE_DAYS.includes(day)) return `day must be one of: ${OVERRIDE_DAYS.join(', ')}`;
    if (!TIME.test(start) || !TIME.test(end)) return 'start and end must be times in HH:MM';
    if (end <= start) return 'end must be after start';
    if (!OVERRIDE_TYPES.includes(type)) return `type must be one of: ${OVERRIDE_TYPES.join(', ')}`;
    return null;
}

/**
 * GET /api/schedules?store_id=
 * A Store's overrides, in week order.
 */
router.get('/', async (req, res) => {
    try {
        if (!req.query.store_id) return res.status(400).json({ error: 'store_id is required' });
        const store = await findManagedStore(req, res, req.query.store_id);
        if (!store) return;
        return res.json(await scheduleOverrideRepository.findForStore(store.id));
    } catch (error) {
        console.error('Failed to fetch schedule overrides:', error);
        return res.status(500).json({ error: 'Failed to fetch schedule overrides' });
    }
});

/**
 * POST /api/schedules
 * Save an override for a Store the caller manages.
 */
router.post('/', async (req, res) => {
    try {
        const { store_id: storeId, day, start, end, type } = req.body;
        if (!storeId) return res.status(400).json({ error: 'store_id is required' });
        const error = invalidOverride({ day, start, end, type });
        if (error) return res.status(400).json({ error });

        const store = await findManagedStore(req, res, storeId);
        if (!store) return;

        const override = await scheduleOverrideRepository.add({
            store_id: store.id,
            retailer_id: store.retailer_id,
            day,
            start,
            end,
            type,
            created_by: req.user.uid,
        });
        return res.status(201).json(override);
    } catch (error) {
        console.error('Failed to save schedule override:', error);
        return res.status(500).json({ error: 'Failed to save schedule override' });
    }
});

export default router;
