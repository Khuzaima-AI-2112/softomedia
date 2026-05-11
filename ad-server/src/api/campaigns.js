import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { requireAuth, requireRole, requireOwnership } from '../middleware/auth.js';

const router = express.Router();
const firestore = new Firestore();
const storage = new Storage();

const BUCKET_NAME = process.env.GCS_BUCKET || 'softomedia-live2026.appspot.com';
const bucket = storage.bucket(BUCKET_NAME);

// Configure multer for memory storage (files stored in memory before upload to GCS)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept video files only
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

/**
 * POST /api/campaigns/create
 * Upload new campaign with video
 * Auth: Brand users only
 */
router.post('/create', requireAuth, requireRole(['brand']), upload.single('video'), async (req, res) => {
    try {
        const { name, duration, budget, target_screens } = req.body;
        const videoFile = req.file;

        // Validation
        if (!name || !duration || !videoFile) {
            return res.status(400).json({
                error: 'Missing required fields: name, duration, video file'
            });
        }

        if (!req.user.linked_entity_id) {
            return res.status(400).json({
                error: 'User not linked to a brand. Please contact support.'
            });
        }

        const brandId = req.user.linked_entity_id;

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `campaigns/${brandId}/${timestamp}_${videoFile.originalname}`;
        const blob = bucket.file(filename);

        // Upload to Cloud Storage
        const blobStream = blob.createWriteStream({
            metadata: {
                contentType: videoFile.mimetype,
                metadata: {
                    uploadedBy: req.user.uid,
                    brandId: brandId,
                    originalName: videoFile.originalname
                }
            }
        });

        await new Promise((resolve, reject) => {
            blobStream.on('error', (error) => {
                console.error('Upload error:', error);
                reject(error);
            });

            blobStream.on('finish', () => {
                resolve();
            });

            blobStream.end(videoFile.buffer);
        });

        // Make file publicly readable (for players to access)
        await blob.makePublic();

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;

        // Parse target screens (JSON array string to array)
        let targetScreensArray = [];
        if (target_screens) {
            try {
                targetScreensArray = JSON.parse(target_screens);
            } catch (e) {
                targetScreensArray = target_screens.split(',').map(s => s.trim());
            }
        }

        // Parse schedule data if provided
        let scheduleData = { enabled: false, rules: [] };
        if (req.body.schedule) {
            try {
                scheduleData = typeof req.body.schedule === 'string'
                    ? JSON.parse(req.body.schedule)
                    : req.body.schedule;
            } catch (e) {
                console.error('Failed to parse schedule:', e);
            }
        }

        // Create campaign document
        const campaignData = {
            brand_id: brandId,
            name: name,
            description: req.body.description || '',
            video_storage_path: filename,
            video_url: publicUrl,
            thumbnail_url: null, // TODO: Generate thumbnail with Cloud Function
            duration_seconds: parseInt(duration),
            start_date: req.body.start_date || new Date().toISOString(),
            end_date: req.body.end_date || null,
            target_screens: targetScreensArray,
            budget: parseFloat(budget) || 0,
            spent: 0,
            status: 'active', // draft | active | paused | completed
            total_impressions: 0,
            avg_cpm: 0,
            completion_rate: 0,
            schedule: scheduleData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const campaignRef = await firestore.collection('campaigns').add(campaignData);

        // Update brand's active campaign count
        await firestore.collection('brands').doc(brandId).update({
            active_campaigns: Firestore.FieldValue.increment(1)
        });

        res.status(201).json({
            campaign_id: campaignRef.id,
            video_url: publicUrl,
            message: 'Campaign created successfully'
        });

    } catch (error) {
        console.error('Campaign creation error:', error);

        if (error.message === 'Only video files are allowed') {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

/**
 * GET /api/campaigns
 * List campaigns with optional filtering
 * Auth: Brands see their own, admins see all
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const { status } = req.query;
        let query = firestore.collection('campaigns');

        // Brands can only see their own campaigns
        if (req.user.role === 'brand') {
            query = query.where('brand_id', '==', req.user.linked_entity_id);
        }

        // Filter by status if provided
        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.orderBy('created_at', 'desc').get();
        const campaigns = [];

        for (const doc of snapshot.docs) {
            campaigns.push({
                id: doc.id,
                ...doc.data()
            });
        }

        res.json({
            campaigns,
            total: campaigns.length
        });

    } catch (error) {
        console.error('List campaigns error:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

/**
 * GET /api/campaigns/:campaignId
 * Get single campaign details
 * Auth: Brand owner or admin
 */
router.get('/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaignDoc = await firestore.collection('campaigns').doc(campaignId).get();

        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = { id: campaignDoc.id, ...campaignDoc.data() };

        // Check permissions
        if (req.user.role !== 'admin' && campaign.brand_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ campaign });

    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign' });
    }
});

/**
 * PUT /api/campaigns/:campaignId
 * Update campaign
 * Auth: Brand owner or admin
 */
router.put('/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const updates = req.body;

        const campaignDoc = await firestore.collection('campaigns').doc(campaignId).get();

        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignDoc.data();

        // Check permissions
        if (req.user.role !== 'admin' && campaign.brand_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Allowed fields to update
        const allowedUpdates = ['name', 'description', 'status', 'budget', 'target_screens', 'end_date'];
        const filteredUpdates = {};

        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }

        filteredUpdates.updated_at = new Date().toISOString();

        await campaignDoc.ref.update(filteredUpdates);

        res.json({
            campaign_id: campaignId,
            message: 'Campaign updated successfully'
        });

    } catch (error) {
        console.error('Update campaign error:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

/**
 * DELETE /api/campaigns/:campaignId
 * Delete campaign
 * Auth: Brand owner or admin
 */
router.delete('/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaignDoc = await firestore.collection('campaigns').doc(campaignId).get();

        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignDoc.data();

        // Check permissions
        if (req.user.role !== 'admin' && campaign.brand_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Delete video file from Cloud Storage
        if (campaign.video_storage_path) {
            try {
                await bucket.file(campaign.video_storage_path).delete();
            } catch (error) {
                console.error('Failed to delete video file:', error);
                // Continue with campaign deletion even if file deletion fails
            }
        }

        // Delete campaign document
        await campaignDoc.ref.delete();

        // Update brand's active campaign count
        await firestore.collection('brands').doc(campaign.brand_id).update({
            active_campaigns: Firestore.FieldValue.increment(-1)
        });

        res.json({
            message: 'Campaign deleted successfully'
        });

    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

/**
 * GET /api/campaigns/:campaignId/report
 * Get finalized campaign report (State 12)
 * Auth: Brand owner or admin
 */
router.get('/:campaignId/report', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaignDoc = await firestore.collection('campaigns').doc(campaignId).get();

        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = { id: campaignDoc.id, ...campaignDoc.data() };

        // Check permissions
        if (req.user.role !== 'admin' && campaign.brand_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Aggregate impressions by location
        const performanceByLocation = [];

        if (campaign.target_screens && campaign.target_screens.length > 0) {
            for (const screenId of campaign.target_screens) {
                // Get screen info
                const screenDoc = await firestore.collection('screens').doc(screenId).get();

                if (screenDoc.exists) {
                    const screenData = screenDoc.data();

                    // Get location info
                    const locationSnapshot = await firestore
                        .collection('screen_locations')
                        .where('screen_id', '==', screenId)
                        .get();

                    const locationName = locationSnapshot.empty
                        ? screenData.location || 'Unknown Location'
                        : locationSnapshot.docs[0].data().name;

                    // Count impressions for this campaign on this screen
                    const impressionsSnapshot = await firestore
                        .collection('screens')
                        .doc(screenId)
                        .collection('impressions')
                        .where('ad_id', '==', campaignId) // Assuming campaign ID used as ad ID
                        .get();

                    const impressions = impressionsSnapshot.size;
                    const spent = impressions * (campaign.avg_cpm / 1000); // CPM calculation

                    performanceByLocation.push({
                        location: locationName,
                        impressions,
                        spent: parseFloat(spent.toFixed(2))
                    });
                }
            }
        }

        const report = {
            id: campaign.id,
            name: campaign.name,
            start_date: campaign.start_date,
            end_date: campaign.end_date || new Date().toISOString(),
            status: campaign.status,
            summary: {
                total_spend: campaign.spent,
                verified_plays: campaign.total_impressions,
                cpm: campaign.avg_cpm,
                completion_rate: campaign.completion_rate
            },
            performance_by_location: performanceByLocation,
            heatmap_data: [] // TODO: Generate heatmap coordinates
        };

        res.json(report);

    } catch (error) {
        console.error('Campaign report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

/**
 * PUT /api/campaigns/:campaignId/schedule
 * Update campaign schedule
 * Auth: Brand owner or admin
 */
router.put('/:campaignId/schedule', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { schedule } = req.body;

        if (!schedule) {
            return res.status(400).json({ error: 'Schedule data is required' });
        }

        const campaignDoc = await firestore.collection('campaigns').doc(campaignId).get();

        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignDoc.data();

        // Check permissions
        if (req.user.role !== 'admin' && campaign.brand_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Validate schedule structure
        if (schedule.enabled && (!schedule.rules || !Array.isArray(schedule.rules))) {
            return res.status(400).json({ error: 'Invalid schedule format. Rules array is required when enabled.' });
        }

        // Update schedule
        await campaignDoc.ref.update({
            schedule: {
                ...schedule,
                updated_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
        });

        res.json({
            campaign_id: campaignId,
            message: 'Schedule updated successfully',
            schedule
        });

    } catch (error) {
        console.error('Update schedule error:', error);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

/**
 * GET /api/campaigns/:campaignId/schedule
 * Get campaign schedule details
 * Auth: Brand owner or admin
 */
router.get('/:campaignId/schedule', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaignDoc = await firestore.collection('campaigns').doc(campaignId).get();

        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignDoc.data();

        // Check permissions
        if (req.user.role !== 'admin' && campaign.brand_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            campaign_id: campaignId,
            schedule: campaign.schedule || { enabled: false, rules: [] }
        });

    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

export default router;
