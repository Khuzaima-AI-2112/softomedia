/**
 * schedules.js
 * Express router — /api/schedules
 *
 * TODO: POST /api/schedules is a stub that saves nothing (issue #16).
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, requirePermission } from '../middleware/requireRole.js';
import BusinessHoursService from '../services/BusinessHoursService.js';

const router = express.Router();

/**
 * GET /api/schedules/preview
 * Returns predicted slot grid for a store on a given date.
 * Fully implemented — no changes.
 */
router.get('/preview', async (req, res) => {
    try {
        const { storeId, date } = req.query;

        if (!storeId || !date) {
            return res.status(400).json({ error: 'storeId and date are required' });
        }

        const effectiveHours = await BusinessHoursService.getEffectiveHours(storeId, date);

        if (effectiveHours.is_closed) {
            return res.json({
                date,
                store_id: storeId,
                is_closed: true,
                slots: [],
            });
        }

        const slots = [];
        const startHour = parseInt(effectiveHours.open_time.split(':')[0]);
        const endHour   = parseInt(effectiveHours.close_time.split(':')[0]);

        for (let h = startHour; h < endHour; h++) {
            slots.push({
                hour:   h,
                status: 'PREDICTED',
                ads:    Array(6).fill(null).map((_, i) => ({
                    slotString: `${String(h).padStart(2, '0')}:${String(i * 10).padStart(2, '0')}`,
                    duration:   10,
                })),
            });
        }

        res.json({
            date,
            store_id: storeId,
            business_hours: {
                start: effectiveHours.open_time,
                end:   effectiveHours.close_time,
            },
            slots,
        });
    } catch (error) {
        console.error('Schedule preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

/**
 * GET /api/schedules
 * Returns active schedule loops.
 */
router.get('/', (req, res) => {
    res.json([
        {
            id:     'loop_standard_60s',
            name:   'Standard 60s Loop',
            type:   'weighted_random',
            active: true,
            rules: {
                loop_duration: 60,
                slot_duration: 5,
                max_ads:       6,
            },
        },
        {
            id:     'loop_prime_time',
            name:   'Prime Time (07-09 PM)',
            type:   'fixed_slot',
            active: true,
            rules: {
                slots:    ['07:00 PM', '08:00 PM', '09:00 PM'],
                priority: 'high',
            },
        },
    ]);
});

/**
 * POST /api/schedules
 * Create a schedule override. Stub: returns the request without saving it.
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.SCHEDULE_OVERRIDE), (req, res) => {
    const id = `sched_${Date.now()}`;
    res.status(201).json({ id, ...req.body });
});

export default router;
