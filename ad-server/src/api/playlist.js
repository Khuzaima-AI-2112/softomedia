import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { generateSignedUrl } from '../utils/storage.js';
import { logger } from '../utils/logger.js';
import { isScheduleActive, generateHourlyLoop } from './schedules.js';

const router = express.Router();
const firestore = new Firestore();

// GET /api/playlist/:screenId
router.get('/:screenId', async (req, res) => {
    try {
        const { screenId } = req.params;
        const currentTime = new Date();

        logger.info(`Fetching playlist request`, { screenId, currentTime: currentTime.toISOString() });

        // 1. Get Approvals for this screen
        const approvalsSnapshot = await firestore.collection('screen_approvals')
            .where('screen_id', '==', screenId)
            .where('status', '==', 'approved')
            .get();

        let campaignIds = [];
        let validationMsg = '';

        if (!approvalsSnapshot.empty) {
            approvalsSnapshot.forEach(doc => {
                campaignIds.push(doc.data().campaign_id);
            });
            validationMsg = `Found ${campaignIds.length} approved campaigns`;
        } else if (screenId === 'demo-screen-01' || screenId.startsWith('test')) {
            // Fallback for demo
            validationMsg = 'No approvals found. Using FALLBACK demo mode.';
            const allCampaigns = await firestore.collection('campaigns').where('status', '==', 'active').get();
            allCampaigns.forEach(doc => campaignIds.push(doc.id));
        } else {
            validationMsg = 'No approvals and not a demo screen.';
        }

        logger.info(`Approval Logic`, { screenId, msg: validationMsg, candidates: campaignIds });

        if (campaignIds.length === 0) {
            return res.json({ playlist: [], loop: [], message: 'No approved campaigns' });
        }

        // 2. Fetch Campaign Details and Filter by Schedule
        const uniqueCampaignIds = [...new Set(campaignIds)];
        const campaignsSnapshot = await firestore.collection('campaigns')
            .where(Firestore.FieldPath.documentId(), 'in', uniqueCampaignIds.slice(0, 10))
            .get();

        const eligibleCampaigns = [];

        for (const doc of campaignsSnapshot.docs) {
            const campaignData = doc.data();

            // Check if campaign schedule is active
            if (isScheduleActive(campaignData.schedule, currentTime)) {
                eligibleCampaigns.push({
                    id: doc.id,
                    ...campaignData
                });
                logger.info(`Campaign is scheduled`, { campaignId: doc.id, name: campaignData.name });
            } else {
                logger.info(`Campaign not scheduled for current time`, { campaignId: doc.id, name: campaignData.name });
            }
        }

        if (eligibleCampaigns.length === 0) {
            logger.info(`No campaigns scheduled for current time`, { screenId, currentTime: currentTime.toISOString() });
            return res.json({ playlist: [], loop: [], message: 'No campaigns scheduled for current time' });
        }

        // 3. Generate 12-slot hourly loop
        const hourlyLoop = generateHourlyLoop(eligibleCampaigns);

        // 4. Build playlist with signed URLs
        const playlist = [];

        for (const campaign of eligibleCampaigns) {
            const signedUrl = await generateSignedUrl(campaign.video_storage_path);

            // Log if duration is unexpected
            if (campaign.duration_seconds !== 5) {
                logger.warn(`Campaign duration mismatch`, {
                    campaignId: campaign.id,
                    expected: 5,
                    actual: campaign.duration_seconds
                });
            }

            playlist.push({
                id: campaign.id,
                type: campaign.type || 'video',
                url: signedUrl,
                duration: campaign.duration_seconds || 5,
                title: campaign.name
            });
        }

        logger.info(`Sending Final Playlist`, {
            screenId,
            count: playlist.length,
            loopSlots: hourlyLoop.length,
            playlistSummary: playlist.map(p => ({ id: p.id, duration: p.duration, file: p.url.split('?')[0] }))
        });

        res.json({
            screen_id: screenId,
            generated_at: currentTime.toISOString(),
            playlist,
            loop: hourlyLoop,
            loop_info: {
                slots_per_minute: 12,
                seconds_per_slot: 5,
                repeats: 60,
                total_campaigns: eligibleCampaigns.length
            }
        });

    } catch (error) {
        logger.error('Playlist Fetch Error', { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
