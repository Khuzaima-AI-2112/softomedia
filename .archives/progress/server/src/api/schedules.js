import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const firestore = new Firestore();

/**
 * Helper function: Check if a campaign's schedule is active at a given time
 */
function isScheduleActive(schedule, currentTime = new Date()) {
    if (!schedule || !schedule.enabled || !schedule.rules || schedule.rules.length === 0) {
        return true; // No schedule means always active
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[currentTime.getDay()];
    const currentTimeString = currentTime.toTimeString().substring(0, 5); // "HH:MM"

    // Check each rule
    for (const rule of schedule.rules) {
        // Check if current day matches
        const dayMatches = rule.days && rule.days.some(day =>
            day.toLowerCase() === currentDay
        );

        if (!dayMatches) continue;

        // Check if current time is within any time range
        for (const timeRange of rule.time_ranges || []) {
            if (currentTimeString >= timeRange.start && currentTimeString <= timeRange.end) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Helper function: Generate 12-slot loop for current hour
 */
function generateHourlyLoop(eligibleCampaigns) {
    const SLOTS_PER_MINUTE = 12;
    const SECONDS_PER_SLOT = 5;

    if (eligibleCampaigns.length === 0) {
        return [];
    }

    const loop = [];
    for (let i = 0; i < SLOTS_PER_MINUTE; i++) {
        const campaignIndex = i % eligibleCampaigns.length; // Round-robin
        const campaign = eligibleCampaigns[campaignIndex];

        loop.push({
            slot_number: i,
            campaign_id: campaign.id,
            ad_id: campaign.id, // Using campaign_id as ad_id for now
            duration: SECONDS_PER_SLOT,
            start_offset: i * SECONDS_PER_SLOT
        });
    }

    return loop;
}

/**
 * GET /api/schedules/active
 * Get all campaigns with active schedules at current time
 * Auth: Required
 */
router.get('/active', requireAuth, async (req, res) => {
    try {
        const currentTime = new Date();
        const campaignsSnapshot = await firestore.collection('campaigns')
            .where('status', '==', 'active')
            .get();

        const activeCampaigns = [];

        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();

            if (isScheduleActive(campaignData.schedule, currentTime)) {
                activeCampaigns.push({
                    id: doc.id,
                    ...campaignData
                });
            }
        }

        res.json({
            current_time: currentTime.toISOString(),
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
 * Get slot allocation for a specific hour
 * Returns the 12-slot loop for that hour
 * Auth: Required
 */
router.get('/slots/:hour', requireAuth, async (req, res) => {
    try {
        const { hour } = req.params;
        const targetTime = new Date(hour);

        if (isNaN(targetTime.getTime())) {
            return res.status(400).json({ error: 'Invalid hour format. Use ISO 8601 format.' });
        }

        // Get all active campaigns for this hour
        const campaignsSnapshot = await firestore.collection('campaigns')
            .where('status', '==', 'active')
            .get();

        const eligibleCampaigns = [];

        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();

            if (isScheduleActive(campaignData.schedule, targetTime)) {
                eligibleCampaigns.push({
                    id: doc.id,
                    name: campaignData.name,
                    brand_id: campaignData.brand_id
                });
            }
        }

        const loop = generateHourlyLoop(eligibleCampaigns);

        // Calculate next hour for cache expiration
        const nextHour = new Date(targetTime);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

        res.json({
            hour: targetTime.toISOString(),
            loop: loop,
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
 * Get timeline data for visualization
 * Shows all campaigns and their scheduled time ranges
 * Auth: Required
 */
router.get('/timeline', requireAuth, async (req, res) => {
    try {
        const { date, brand_id } = req.query;
        const targetDate = date ? new Date(date) : new Date();

        let query = firestore.collection('campaigns').where('status', '==', 'active');

        // Filter by brand if specified and user has permission
        if (brand_id) {
            if (req.user.role === 'brand' && req.user.linked_entity_id !== brand_id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            query = query.where('brand_id', '==', brand_id);
        } else if (req.user.role === 'brand') {
            // Brands can only see their own campaigns
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
                status: campaignData.status
            });
        }

        res.json({
            date: targetDate.toISOString(),
            timeline,
            count: timeline.length
        });

    } catch (error) {
        logger.error('Get timeline error:', error);
        res.status(500).json({ error: 'Failed to generate timeline' });
    }
});

/**
 * POST /api/schedules/validate
 * Validate a schedule before saving
 * Auth: Required
 */
router.post('/validate', requireAuth, async (req, res) => {
    try {
        const { schedule } = req.body;

        if (!schedule) {
            return res.status(400).json({
                valid: false,
                errors: ['Schedule data is required']
            });
        }

        const errors = [];

        // Validate structure
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

        res.json({
            valid: errors.length === 0,
            errors
        });

    } catch (error) {
        logger.error('Validate schedule error:', error);
        res.status(500).json({ error: 'Failed to validate schedule' });
    }
});

export { isScheduleActive, generateHourlyLoop };
export default router;
