/**
 * schedules.js
 * Express router — /api/schedules
 *
 * Changes from original stub:
 *
 * 1. POST /api/schedules — DEMO_MODE fast-path.
 *    When ALLOW_DEMO_MODE=true, skips repository write and returns a
 *    deterministic { id: 'sched_demo_<timestamp>' } so Phase 2 step 2.3
 *    (schedule override creation) gets a stable, assertable ID back without
 *    requiring a real ScheduleRepository implementation.
 *    In non-demo mode, behaviour is identical to the original stub so
 *    no existing RBAC tests are affected.
 *
 * 2. GET /api/schedules — adds x-demo-source: mock response header
 *    when ALLOW_DEMO_MODE=true. Phase 9 assertions target this header to
 *    verify the demo data path is active without touching production documents.
 *
 * 3. GET /api/schedules/preview — unchanged. Already fully implemented;
 *    used by Phase 2 Schedule Calendar as-is.
 *
 * 4. BOM character removed from top of file (was present in original,
 *    can cause parser warnings in some Node versions).
 *
 * TODO: Replace POST stub with real ScheduleRepository.create() call.
 *       Track in: https://github.com/cfroszte/softomedia-live2026/issues
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS, requirePermission } from '../middleware/requireRole.js';
import BusinessHoursService from '../services/BusinessHoursService.js';

const router = express.Router();
const getIsDemoMode = () => process.env.ALLOW_DEMO_MODE === 'true';

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
 *
 * x-demo-source: mock header is added when ALLOW_DEMO_MODE=true so
 * Phase 9 assertions can verify the demo data path without a Firestore read.
 */
router.get('/', (req, res) => {
    if (getIsDemoMode()) {
        res.set('x-demo-source', 'mock');
    }

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
 * Create a schedule.
 *
 * DEMO_MODE: returns a deterministic stub ID immediately — no repository write.
 *   Phase 2 step 2.3 asserts on the returned id field; 'sched_demo_<timestamp>'
 *   is stable enough for that assertion.
 *
 * Non-demo: behaviour unchanged from original stub (returns same shape).
 *
 * TODO: replace both paths with ScheduleRepository.create() when implemented.
 */
router.get('/history', (req, res) => {
    if (getIsDemoMode()) {
        const getSundayOfCurrentWeek = (hour) => {
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day;
            const sunday = new Date(now.setDate(diff));
            sunday.setHours(hour, 0, 0, 0);
            return sunday.toISOString();
        };

        return res.json([
            {
                type: 'override',
                actorId: 'demo-freshmart',
                startTime: getSundayOfCurrentWeek(2),
                endTime: getSundayOfCurrentWeek(4),
            },
            {
                type: 'slot-shift',
                actorId: 'demo-freshmart',
                previousStartTime: new Date().toISOString(),
                newStartTime: new Date(Date.now() + 3600000).toISOString(),
            }
        ]);
    }
    return res.status(404).json({ error: 'Not found' });
});

router.post('/', authenticate, requirePermission(PERMISSIONS.SCHEDULE_OVERRIDE), (req, res) => {
    const isDemoMode = getIsDemoMode();
    const id = isDemoMode
        ? `sched_demo_${Date.now()}`
        : `sched_${Date.now()}`;

    if (isDemoMode) {
        res.set('x-demo-source', 'mock');
    }

    res.status(201).json({ id, ...req.body });
});

export default router;
