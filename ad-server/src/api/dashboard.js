import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { requireAuth, requireRole, requireOwnership } from '../middleware/auth.js';
import { calculateRetailerEarnings } from '../utils/helpers.js';

const router = express.Router();
const firestore = new Firestore();

/**
 * GET /api/dashboard/retailer/:retailerId
 * Simplified retailer concierge view (State 10)
 * Auth: Retailer owner or Admin
 */
router.get('/retailer/:retailerId', requireAuth, requireOwnership('retailer', 'retailerId'), async (req, res) => {
    try {
        const { retailerId } = req.params;

        // Get screen info (retailerId is actually screenId in our system)
        const screenDoc = await firestore.collection('screens').doc(retailerId).get();

        if (!screenDoc.exists) {
            return res.status(404).json({ error: 'Screen not found' });
        }

        const retailerData = screenDoc.data();

        // Get screens for this retailer
        const screensSnapshot = await firestore
            .collection('screens')
            .where('retailer_id', '==', retailerId)
            .get();

        let systemStatus = 'offline';
        let screenInfo = null;

        if (!screensSnapshot.empty) {
            const firstScreen = screensSnapshot.docs[0];
            const screenData = firstScreen.data();

            // Check if screen seen in last 10 minutes
            const lastSeen = new Date(screenData.last_seen);
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

            systemStatus = lastSeen > tenMinutesAgo ? 'online' : 'offline';

            screenInfo = {
                screen_id: screenData.screen_id,
                location: screenData.location || retailerData.business_name,
                uptime: screenData.stats?.uptime_percentage || 0
            };
        }

        // Calculate earnings for current month
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthEarnings = await calculateRetailerEarnings(retailerId, currentMonth, firestore);

        // Get last month earnings
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const lastMonthEarnings = await calculateRetailerEarnings(retailerId, lastMonth, firestore);

        res.json({
            system_status: systemStatus,
            screen: screenInfo,
            earnings: {
                current_month: currentMonthEarnings,
                last_month: lastMonthEarnings,
                total: currentMonthEarnings + lastMonthEarnings // Simplified for MVP
            }
        });

    } catch (error) {
        console.error('Retailer dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

/**
 * GET /api/dashboard/brand/:brandId
 * Brand dashboard with campaign performance and screen locations (State 5)
 * Auth: Brand owner or Admin
 */
router.get('/brand/:brandId', requireAuth, async (req, res) => {
    try {
        const { brandId } = req.params;

        // Get brand info (brands = advertisers in our system)
        const brandDoc = await firestore.collection('advertisers').doc(brandId).get();

        if (!brandDoc.exists) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        const brandData = brandDoc.data();

        // Get all campaigns for this brand
        const campaignsSnapshot = await firestore
            .collection('campaigns')
            .where('brand_id', '==', brandId)
            .get();

        const campaigns = [];
        let totalImpressions = 0;
        const activeScreenIds = new Set();

        for (const campaignDoc of campaignsSnapshot.docs) {
            const campaign = { id: campaignDoc.id, ...campaignDoc.data() };

            campaigns.push({
                id: campaign.id,
                title: campaign.name || campaign.title,  // Support both field names
                impressions: campaign.total_impressions || 0,
                status: campaign.status,
                duration: campaign.duration_seconds || 5  // Default to 5s if not specified
            });

            totalImpressions += campaign.total_impressions || 0;

            // Track unique screens
            if (campaign.target_screens) {
                campaign.target_screens.forEach(screenId => activeScreenIds.add(screenId));
            }
        }

        // Get advertising credits from user record
        const userSnapshot = await firestore
            .collection('users')
            .where('linked_entity_id', '==', brandId)
            .where('role', '==', 'brand')
            .limit(1)
            .get();

        const advertising_credits = !userSnapshot.empty 
            ? userSnapshot.docs[0].data().advertising_credits || 0 
            : 0;

        // Get screen locations for active screens
        const screenLocations = [];

        for (const screenId of activeScreenIds) {
            const locationDoc = await firestore
                .collection('screen_locations')
                .where('screen_id', '==', screenId)
                .get();

            if (!locationDoc.empty) {
                const locationData = locationDoc.docs[0].data();

                // Get screen status
                const screenDoc = await firestore.collection('screens').doc(screenId).get();
                const screenData = screenDoc.exists ? screenDoc.data() : {};

                screenLocations.push({
                    name: locationData.name,
                    coordinates: locationData.coordinates,
                    status: screenData.status || 'unknown',
                    impressions: screenData.stats?.total_impressions || 0
                });
            }
        }

        // Return structure matching frontend expectations
        res.json({
            summary: {
                total_campaigns: campaigns.length,
                total_impressions: totalImpressions,
                screens_reached: activeScreenIds.size
            },
            credits: advertising_credits,
            campaigns: campaigns,
            screen_locations: screenLocations
        });

    } catch (error) {
        console.error('Brand dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

export default router;
