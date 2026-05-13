import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const firestore = new Firestore();

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────
function isScheduleActive(schedule, currentTime = new Date()) {
    if (!schedule || !schedule.enabled || !schedule.rules || schedule.rules.length === 0) {
        return true;
    }
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[currentTime.getDay()];
    const currentTimeString = currentTime.toTimeString().substring(0, 5);
    for (const rule of schedule.rules) {
        const dayMatches = rule.days && rule.days.some(d => d.toLowerCase() === currentDay);
        if (!dayMatches) continue;
        for (const timeRange of rule.time_ranges || []) {
            if (currentTimeString >= timeRange.start && currentTimeString <= timeRange.end) return true;
        }
    }
    return false;
}

function campaignTargetsLocation(campaignData, locationId) {
    const targets = campaignData.target_location_ids;
    if (!targets || targets.length === 0) return true;
    return targets.includes(locationId);
}

function generateHourlyLoop(eligibleCampaigns) {
    const SLOTS_PER_MINUTE = 12;
    const SECONDS_PER_SLOT = 5;
    if (eligibleCampaigns.length === 0) return [];
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

// ───────────────────────────────────────────────────────────────────────────
// GET /api/schedules/active
// ───────────────────────────────────────────────────────────────────────────
router.get('/active', requireAuth, async (req, res) => {
    try {
        const { screen_id } = req.query;
        const currentTime = new Date();
        let locationId = null;
        if (screen_id) {
            const screenDoc = await firestore.collection('screens').doc(screen_id).get();
            if (screenDoc.exists) locationId = screenDoc.data().location_id || null;
        }
        const campaignsSnapshot = await firestore.collection('campaigns').where('status', '==', 'active').get();
        const activeCampaigns = [];
        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();
            if (!isScheduleActive(campaignData.schedule, currentTime)) continue;
            if (locationId && !campaignTargetsLocation(campaignData, locationId)) continue;
            activeCampaigns.push({ id: doc.id, ...campaignData });
        }
        res.json({ current_time: currentTime.toISOString(), screen_id: screen_id || null, location_id: locationId, active_campaigns: activeCampaigns, count: activeCampaigns.length });
    } catch (error) {
        logger.error('Get active schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch active schedules' });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/schedules/slots/:hour
// ───────────────────────────────────────────────────────────────────────────
router.get('/slots/:hour', requireAuth, async (req, res) => {
    try {
        const { hour } = req.params;
        const { screen_id } = req.query;
        const targetTime = new Date(hour);
        if (isNaN(targetTime.getTime())) return res.status(400).json({ error: 'Invalid hour format. Use ISO 8601.' });
        let locationId = null;
        if (screen_id) {
            const screenDoc = await firestore.collection('screens').doc(screen_id).get();
            if (screenDoc.exists) locationId = screenDoc.data().location_id || null;
        }
        const campaignsSnapshot = await firestore.collection('campaigns').where('status', '==', 'active').get();
        const eligibleCampaigns = [];
        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();
            if (!isScheduleActive(campaignData.schedule, targetTime)) continue;
            if (locationId && !campaignTargetsLocation(campaignData, locationId)) continue;
            eligibleCampaigns.push({ id: doc.id, name: campaignData.name, brand_id: campaignData.brand_id });
        }
        const loop = generateHourlyLoop(eligibleCampaigns);
        const nextHour = new Date(targetTime);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        res.json({ hour: targetTime.toISOString(), screen_id: screen_id || null, location_id: locationId, loop, repeats: 60, eligible_campaigns: eligibleCampaigns.length, cache_until: nextHour.toISOString() });
    } catch (error) {
        logger.error('Get slot allocation error:', error);
        res.status(500).json({ error: 'Failed to generate slot allocation' });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/schedules/timeline
// ───────────────────────────────────────────────────────────────────────────
router.get('/timeline', requireAuth, async (req, res) => {
    try {
        const { date, brand_id } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        let query = firestore.collection('campaigns').where('status', '==', 'active');
        if (brand_id) {
            if (req.user.role === 'brand' && req.user.linked_entity_id !== brand_id) return res.status(403).json({ error: 'Access denied' });
            query = query.where('brand_id', '==', brand_id);
        } else if (req.user.role === 'brand') {
            query = query.where('brand_id', '==', req.user.linked_entity_id);
        }
        const campaignsSnapshot = await query.get();
        const timeline = [];
        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();
            timeline.push({ campaign_id: doc.id, name: campaignData.name, brand_id: campaignData.brand_id, schedule: campaignData.schedule || { enabled: false, rules: [] }, target_location_ids: campaignData.target_location_ids || [], status: campaignData.status });
        }
        res.json({ date: targetDate.toISOString(), timeline, count: timeline.length });
    } catch (error) {
        logger.error('Get timeline error:', error);
        res.status(500).json({ error: 'Failed to generate timeline' });
    }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /api/schedules/validate
// ───────────────────────────────────────────────────────────────────────────
router.post('/validate', requireAuth, async (req, res) => {
    try {
        const { schedule } = req.body;
        if (!schedule) return res.status(400).json({ valid: false, errors: ['Schedule data is required'] });
        const errors = [];
        if (schedule.enabled) {
            if (!schedule.rules || !Array.isArray(schedule.rules)) {
                errors.push('Rules array is required when schedule is enabled');
            } else {
                schedule.rules.forEach((rule, index) => {
                    if (!rule.days || rule.days.length === 0) errors.push(`Rule ${index + 1}: At least one day must be selected`);
                    if (!rule.time_ranges || rule.time_ranges.length === 0) {
                        errors.push(`Rule ${index + 1}: At least one time range is required`);
                    } else {
                        rule.time_ranges.forEach((range, rangeIndex) => {
                            if (!range.start || !range.end) errors.push(`Rule ${index + 1}, Range ${rangeIndex + 1}: Start and end times are required`);
                            else if (range.start >= range.end) errors.push(`Rule ${index + 1}, Range ${rangeIndex + 1}: Start time must be before end time`);
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

// ───────────────────────────────────────────────────────────────────────────
// Sprint 8 — Retailer Ad Approval Workflow
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /api/schedules/pending-approval
 * Returns all ads in status 'pending_review' scoped to the retailer's
 * stores/locations. Admin sees all; retailer sees only their own.
 */
router.get('/pending-approval', requireAuth, async (req, res) => {
    try {
        const { role, linked_entity_id } = req.user;
        if (!['retailer', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Access denied. Retailer or Admin role required.' });
        }

        let adsQuery = firestore.collection('ads').where('status', '==', 'pending_review');

        if (role === 'retailer') {
            const storesSnap = await firestore.collection('stores')
                .where('retailer_id', '==', linked_entity_id)
                .get();
            const storeIds = storesSnap.docs.map(d => d.id);
            if (storeIds.length === 0) return res.json({ ads: [], total: 0 });
            adsQuery = adsQuery.where('target_store_ids', 'array-contains-any', storeIds);
        }

        const adsSnap = await adsQuery.get();
        const ads = adsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ ads, total: ads.length });
    } catch (error) {
        logger.error('Pending approval fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch pending ads' });
    }
});

/**
 * GET /api/schedules/preview/:scheduleId
 * Returns a 24-hour slot preview for a specific ad.
 */
router.get('/preview/:scheduleId', requireAuth, async (req, res) => {
    try {
        const { role } = req.user;
        if (!['retailer', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const { scheduleId } = req.params;
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const dateStr = targetDate.toISOString().split('T')[0];

        const adDoc = await firestore.collection('ads').doc(scheduleId).get();
        if (!adDoc.exists) return res.status(404).json({ error: 'Ad not found' });
        const adData = { id: adDoc.id, ...adDoc.data() };

        let campaignData = null;
        if (adData.campaign_id) {
            const campDoc = await firestore.collection('campaigns').doc(adData.campaign_id).get();
            if (campDoc.exists) campaignData = { id: campDoc.id, ...campDoc.data() };
        }

        const hourlyPreview = [];
        for (let hour = 0; hour < 24; hour++) {
            const slotTime = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00Z`);
            const isActive = campaignData ? isScheduleActive(campaignData.schedule, slotTime) : true;
            hourlyPreview.push({
                hour,
                time_label: `${String(hour).padStart(2, '0')}:00`,
                is_active: isActive,
                slots: isActive ? 12 : 0,
                plays_per_hour: isActive ? 12 * 60 : 0,
            });
        }

        res.json({
            ad: adData,
            campaign: campaignData,
            date: dateStr,
            hourly_preview: hourlyPreview,
            total_active_hours: hourlyPreview.filter(h => h.is_active).length,
            total_daily_plays: hourlyPreview.reduce((sum, h) => sum + h.plays_per_hour, 0),
        });
    } catch (error) {
        logger.error('Schedule preview error:', error);
        res.status(500).json({ error: 'Failed to generate schedule preview' });
    }
});

/**
 * POST /api/schedules/approve/:adId
 * Retailer approves an ad. Sets status to 'approved', writes audit log.
 * Body: { store_ids?: string[], notes?: string }
 */
router.post('/approve/:adId', requireAuth, async (req, res) => {
    try {
        const { role, linked_entity_id, uid } = req.user;
        if (!['retailer', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const { adId } = req.params;
        const { store_ids = [], notes = '' } = req.body;

        const adRef = firestore.collection('ads').doc(adId);
        const adDoc = await adRef.get();
        if (!adDoc.exists) return res.status(404).json({ error: 'Ad not found' });

        const adData = adDoc.data();
        if (adData.status !== 'pending_review') {
            return res.status(409).json({ error: `Ad is already in status: ${adData.status}` });
        }

        const now = new Date().toISOString();
        await adRef.update({
            status: 'approved',
            reviewed_at: now,
            reviewed_by: uid,
            retailer_approval: { retailer_id: linked_entity_id || uid, approved_by: uid, approved_at: now, store_ids, notes },
            updated_at: now,
        });

        await firestore.collection('audit_logs').add({
            action: 'ad_approved', entity_type: 'ad', entity_id: adId,
            performed_by: uid, retailer_id: linked_entity_id || null,
            store_ids, notes, timestamp: now,
        });

        logger.info(`[Schedules] Ad approved: ${adId} by ${uid}`);
        const updated = await adRef.get();
        res.json({ id: updated.id, ...updated.data() });
    } catch (error) {
        logger.error('Ad approval error:', error);
        res.status(500).json({ error: 'Failed to approve ad' });
    }
});

/**
 * POST /api/schedules/reject/:adId
 * Retailer rejects an ad with a mandatory reason. Writes audit log.
 * Body: { reason: string, store_ids?: string[] }
 */
router.post('/reject/:adId', requireAuth, async (req, res) => {
    try {
        const { role, linked_entity_id, uid } = req.user;
        if (!['retailer', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const { adId } = req.params;
        const { reason, store_ids = [] } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ error: 'A rejection reason is required.' });
        }

        const adRef = firestore.collection('ads').doc(adId);
        const adDoc = await adRef.get();
        if (!adDoc.exists) return res.status(404).json({ error: 'Ad not found' });

        const adData = adDoc.data();
        if (adData.status !== 'pending_review') {
            return res.status(409).json({ error: `Ad is already in status: ${adData.status}` });
        }

        const now = new Date().toISOString();
        await adRef.update({
            status: 'rejected',
            reviewed_at: now,
            reviewed_by: uid,
            rejection_reason: reason.trim(),
            retailer_rejection: { retailer_id: linked_entity_id || uid, rejected_by: uid, rejected_at: now, store_ids, reason: reason.trim() },
            updated_at: now,
        });

        await firestore.collection('audit_logs').add({
            action: 'ad_rejected', entity_type: 'ad', entity_id: adId,
            performed_by: uid, retailer_id: linked_entity_id || null,
            store_ids, reason: reason.trim(), timestamp: now,
        });

        logger.info(`[Schedules] Ad rejected: ${adId} by ${uid} — reason: ${reason}`);
        const updated = await adRef.get();
        res.json({ id: updated.id, ...updated.data() });
    } catch (error) {
        logger.error('Ad rejection error:', error);
        res.status(500).json({ error: 'Failed to reject ad' });
    }
});

export { isScheduleActive, generateHourlyLoop, campaignTargetsLocation };
export default router;
