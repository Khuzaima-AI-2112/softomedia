```javascript
import express from 'express';


const router = express.Router();

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

export default router;
