import express from 'express';
import BusinessHoursService from '../services/BusinessHoursService.js';


const router = express.Router();

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
                slots: []
            });
        }

        // Generate prediction slots based on business hours
        const slots = [];
        const startHour = parseInt(effectiveHours.open_time.split(':')[0]);
        const endHour = parseInt(effectiveHours.close_time.split(':')[0]);

        for (let h = startHour; h < endHour; h++) {
            slots.push({
                hour: h,
                status: 'PREDICTED',
                // Mock ad slots for the hour
                ads: Array(6).fill(null).map((_, i) => ({
                    slotString: `${String(h).padStart(2, '0')}:${String(i * 10).padStart(2, '0')}`,
                    duration: 10
                }))
            });
        }

        res.json({
            date,
            store_id: storeId,
            business_hours: {
                start: effectiveHours.open_time,
                end: effectiveHours.close_time
            },
            slots
        });

    } catch (error) {
        console.error('Schedule preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

/**
 * GET /api/schedules
 * Returns active schedule loops in the network
 * TODO: Integrate with ScheduleRepository for multi-tenant rules
 */
router.get('/', (req, res) => {
    // Standard MVP schedule slots
    const baseSchedules = [
        {
            id: 'loop_standard_60s',
            name: 'Standard 60s Loop',
            type: 'weighted_random',
            active: true,
            rules: {
                loop_duration: 60,
                slot_duration: 5,
                max_ads: 6
            }
        },
        {
            id: 'loop_prime_time',
            name: 'Prime Time (07-09 PM)',
            type: 'fixed_slot',
            active: true,
            rules: {
                slots: ['07:00 PM', '08:00 PM', '09:00 PM'],
                priority: 'high'
            }
        }
    ];

    res.json(baseSchedules);
});

/**
 * POST /api/schedules
 * Stub endpoint for creating schedules (Testing RBAC enforcement)
 */
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

router.post('/', authenticate, requireRole('admin'), (req, res) => {
    // In actual implementation, we would insert to ScheduleRepository here
    res.status(201).json({ id: 'sched_' + Date.now(), ...req.body });
});

export default router;
