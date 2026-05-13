import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const firestore = new Firestore();

/**
 * Helper: Check if a campaign schedule is active at a given time
 */
function isScheduleActive(schedule, currentTime = new Date()) {
    if (!schedule || !schedule.enabled || !schedule.rules || schedule.rules.length === 0) {
        return true; // No schedule = always active
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[currentTime.getDay()];
    const currentTimeString = currentTime.toTimeString().substring(0, 5); // "HH:MM"

    for (const rule of schedule.rules) {
        const dayMatches = rule.days && rule.days.some(day => day.toLowerCase() === currentDay);
        if (!dayMatches) continue;

        for (const timeRange of rule.time_ranges || []) {
            if (currentTimeString >= timeRange.start && currentTimeString <= timeRange.end) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Helper: Check if a campaign targets a specific location/screen.
 * Sprint 5: Campaigns may optionally carry a target_location_ids array.
 * If the array is absent or empty, the campaign is global (targets all screens).
 * If the array is present, the campaign only plays on matching location_ids.
 */
function campaignTargetsLocation(campaignData, locationId) {
    const targets = campaignData.target_location_ids;
    if (!targets || targets.length === 0) {
        return true; // Global campaign — plays everywhere
    }
    return targets.includes(locationId);
}

/**
 * Helper: Generate 12-slot round-robin loop for current hour
 */
function generateHourlyLoop(eligibleCampaigns) {
    const SLOTS_PER_MINUTE = 12;
    const SECONDS_PER_SLOT = 5;

    if (eligibleCampaigns.length === 0) {
        return [];
    }

    const loop = [];
    for (let i = 0; i < SLOTS_PER_MINUTE; i++) {
        const campaign = eligibleCampaigns[i % eligibleCampaigns.length];
        loop.push({
            slot_number: i,
            campaign_id: campaign.id,
            ad_id: campaign.id,
            duration: SECONDS_PER_SLOT,
            start_offset: i * SECONDS_PER_SLOT
        });
    }

    return loop;
}

/**
 * GET /api/schedules/active
 * Get all campaigns with active schedules at current time.
 * Optional ?screen_id= param: if provided, also filters by location targeting.
 * Auth: Required
 */
router.get('/active', requireAuth, async (req, res) => {
    try {
        const { screen_id } = req.query;
        const currentTime = new Date();

        // Resolve the screen's location_id if screen_id is provided
        let locationId = null;
        if (screen_id) {
            const screenDoc = await firestore.collection('screens').doc(screen_id).get();
            if (screenDoc.exists) {
                locationId = screenDoc.data().location_id || null;
            }
        }

        const campaignsSnapshot = await firestore.collection('campaigns')
            .where('status', '==', 'active')
            .get();

        const activeCampaigns = [];

        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();

            if (!isScheduleActive(campaignData.schedule, currentTime)) continue;

            // Sprint 5: filter by location targeting when a screen_id is supplied
            if (locationId && !campaignTargetsLocation(campaignData, locationId)) continue;

            activeCampaigns.push({ id: doc.id, ...campaignData });
        }

        res.json({
            current_time: currentTime.toISOString(),
            screen_id: screen_id || null,
            location_id: locationId,
            active_campaigns: activeCampaigns,
            count: activeCampaigns.length
        });

    } catch (error) {
        logger.error('Get active schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch active schedules' });
    }
});

/**
 * GET /api/schedules/slots/:hour
 * Get slot allocation for a specific hour.
 * Sprint 5: Accepts optional ?screen_id= to return location-targeted slot loop.
 * Auth: Required
 */
router.get('/slots/:hour', requireAuth, async (req, res) => {
    try {
        const { hour } = req.params;
        const { screen_id } = req.query;
        const targetTime = new Date(hour);

        if (isNaN(targetTime.getTime())) {
            return res.status(400).json({ error: 'Invalid hour format. Use ISO 8601.' });
        }

        // Resolve location_id from screen if provided
        let locationId = null;
        if (screen_id) {
            const screenDoc = await firestore.collection('screens').doc(screen_id).get();
            if (screenDoc.exists) {
                locationId = screenDoc.data().location_id || null;
            }
        }

        const campaignsSnapshot = await firestore.collection('campaigns')
            .where('status', '==', 'active')
            .get();

        const eligibleCampaigns = [];

        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();

            if (!isScheduleActive(campaignData.schedule, targetTime)) continue;

            // Sprint 5: filter by location targeting
            if (locationId && !campaignTargetsLocation(campaignData, locationId)) continue;

            eligibleCampaigns.push({
                id: doc.id,
                name: campaignData.name,
                brand_id: campaignData.brand_id
            });
        }

        const loop = generateHourlyLoop(eligibleCampaigns);

        const nextHour = new Date(targetTime);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

        res.json({
            hour: targetTime.toISOString(),
            screen_id: screen_id || null,
            location_id: locationId,
            loop,
            repeats: 60,
            eligible_campaigns: eligibleCampaigns.length,
            cache_until: nextHour.toISOString()
        });

    } catch (error) {
        logger.error('Get slot allocation error:', error);
        res.status(500).json({ error: 'Failed to generate slot allocation' });
    }
});

/**
 * GET /api/schedules/timeline
 * Timeline for visualization — all campaigns and their scheduled time ranges.
 * Auth: Required
 */
router.get('/timeline', requireAuth, async (req, res) => {
    try {
        const { date, brand_id } = req.query;
        const targetDate = date ? new Date(date) : new Date();

        let query = firestore.collection('campaigns').where('status', '==', 'active');

        if (brand_id) {
            if (req.user.role === 'brand' && req.user.linked_entity_id !== brand_id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            query = query.where('brand_id', '==', brand_id);
        } else if (req.user.role === 'brand') {
            query = query.where('brand_id', '==', req.user.linked_entity_id);
        }

        const campaignsSnapshot = await query.get();
        const timeline = [];

        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();
            timeline.push({
                campaign_id: doc.id,
                name: campaignData.name,
                brand_id: campaignData.brand_id,
                schedule: campaignData.schedule || { enabled: false, rules: [] },
                target_location_ids: campaignData.target_location_ids || [],
                status: campaignData.status
            });
        }

        res.json({ date: targetDate.toISOString(), timeline, count: timeline.length });

    } catch (error) {
        logger.error('Get timeline error:', error);
        res.status(500).json({ error: 'Failed to generate timeline' });
    }
});

/**
 * POST /api/schedules/validate
 * Validate a schedule object before saving to a campaign.
 * Auth: Required
 */
router.post('/validate', requireAuth, async (req, res) => {
    try {
        const { schedule } = req.body;

        if (!schedule) {
            return res.status(400).json({ valid: false, errors: ['Schedule data is required'] });
        }

        const errors = [];

        if (schedule.enabled) {
            if (!schedule.rules || !Array.isArray(schedule.rules)) {
                errors.push('Rules array is required when schedule is enabled');
            } else {
                schedule.rules.forEach((rule, index) => {
                    if (!rule.days || rule.days.length === 0) {
                        errors.push(`Rule ${index + 1}: At least one day must be selected`);
                    }
                    if (!rule.time_ranges || rule.time_ranges.length === 0) {
                        errors.push(`Rule ${index + 1}: At least one time range is required`);
                    } else {
                        rule.time_ranges.forEach((range, rangeIndex) => {
                            if (!range.start || !range.end) {
                                errors.push(`Rule ${index + 1}, Range ${rangeIndex + 1}: Start and end times are required`);
                            } else if (range.start >= range.end) {
                                errors.push(`Rule ${index + 1}, Range ${rangeIndex + 1}: Start time must be before end time`);
                            }
                        });
                    }
                });
            }
        }

        res.json({ valid: errors.length === 0, errors });

    } catch (error) {
        logger.error('Validate schedule error:', error);
        res.status(500).json({ error: 'Failed to validate schedule' });
    }
});

export { isScheduleActive, generateHourlyLoop, campaignTargetsLocation };
export default router;
