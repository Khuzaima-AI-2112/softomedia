import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const firestore = new Firestore();
const screensCollection = firestore.collection('screens');

// GET /api/screens
// List all screens with their stats (basic endpoint)
router.get('/', async (req, res) => {
    try {
        const snapshot = await screensCollection.get();
        const screens = [];
        snapshot.forEach(doc => {
            screens.push({ id: doc.id, ...doc.data() });
        });
        res.json({ screens });
    } catch (error) {
        console.error('Error fetching screens:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/screens/management
// Enhanced screen management with filtering and search
// Auth: Admin only
router.get('/management', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { status, search, sort = 'last_seen', order = 'desc' } = req.query;

        const snapshot = await screensCollection.get();
        let screens = [];

        for (const doc of snapshot.docs) {
            const screenData = doc.data();

            let locationName = screenData.location || 'Unknown Location';
            let retailerName = 'N/A';

            if (screenData.retailer_id) {
                const retailerDoc = await firestore.collection('retailers').doc(screenData.retailer_id).get();
                if (retailerDoc.exists) {
                    retailerName = retailerDoc.data().business_name;
                }
            }

            const lastSeen = new Date(screenData.last_seen || 0);
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const isOnline = lastSeen > tenMinutesAgo;
            const actualStatus = isOnline ? 'active' : 'offline';
            const timeSince = formatTimeSince(screenData.last_seen);

            screens.push({
                screen_id: screenData.screen_id,
                location: locationName,
                location_id: screenData.location_id || null,
                retailer: retailerName,
                retailer_id: screenData.retailer_id || null,
                status: actualStatus,
                last_heartbeat: timeSince,
                last_seen: screenData.last_seen,
                stats: screenData.stats || {},
                diagnostics: screenData.diagnostics || {}
            });
        }

        if (status && status !== 'all') {
            screens = screens.filter(s => s.status === status);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            screens = screens.filter(s =>
                s.screen_id.toLowerCase().includes(searchLower) ||
                s.location.toLowerCase().includes(searchLower)
            );
        }

        screens.sort((a, b) => {
            let aVal, bVal;
            if (sort === 'last_seen') {
                aVal = new Date(a.last_seen || 0).getTime();
                bVal = new Date(b.last_seen || 0).getTime();
            } else if (sort === 'screen_id') {
                aVal = a.screen_id;
                bVal = b.screen_id;
            } else if (sort === 'location') {
                aVal = a.location;
                bVal = b.location;
            } else {
                return 0;
            }
            return order === 'desc' ? (aVal < bVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
        });

        res.json({ screens, total: snapshot.size, filtered: screens.length });

    } catch (error) {
        console.error('Screen management error:', error);
        res.status(500).json({ error: 'Failed to fetch screens' });
    }
});

// Helper: format time since timestamp
function formatTimeSince(timestamp) {
    if (!timestamp) return 'Never';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

// POST /api/screens/register
// Called by the Player when it starts up.
// Sprint 5 fix: removed duplicate 'status' key — single clean 'active' default.
router.post('/register', async (req, res) => {
    try {
        const { screen_id, resolution, user_agent } = req.body;

        if (!screen_id) {
            return res.status(400).json({ error: 'screen_id is required' });
        }

        const docRef = screensCollection.doc(screen_id);
        const doc = await docRef.get();

        if (doc.exists) {
            await docRef.update({
                last_seen: new Date().toISOString(),
                resolution: resolution || 'unknown',
                user_agent: user_agent || 'unknown'
            });
            console.log(`Screen ${screen_id} checked in.`);
            return res.json({ status: 'registered', data: doc.data() });
        } else {
            const newScreen = {
                screen_id,
                status: 'active',
                created_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                resolution: resolution || 'unknown',
                user_agent: user_agent || 'unknown',
                current_playlist: [],
                location_id: null,
                retailer_id: null
            };
            await docRef.set(newScreen);
            console.log(`New screen registered: ${screen_id}`);
            return res.status(201).json({ status: 'created', data: newScreen });
        }

    } catch (error) {
        console.error('Screen registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/screens/:screenId/impressions
// Called by the Player to report an ad view
router.post('/:screenId/impressions', async (req, res) => {
    try {
        const { screenId } = req.params;
        const { ad_id, timestamp, duration } = req.body;

        if (!ad_id) {
            return res.status(400).json({ error: 'ad_id is required' });
        }

        await screensCollection.doc(screenId).collection('impressions').add({
            ad_id,
            timestamp: timestamp || new Date().toISOString(),
            duration: duration || 0,
            received_at: new Date().toISOString()
        });

        await screensCollection.doc(screenId).update({
            'stats.total_impressions': Firestore.FieldValue.increment(1),
            'stats.total_play_time': Firestore.FieldValue.increment(duration || 0),
            'stats.last_updated': new Date().toISOString()
        });

        await firestore.collection('ads').doc(ad_id).update({
            'stats.impressions': Firestore.FieldValue.increment(1),
            'stats.play_time': Firestore.FieldValue.increment(duration || 0)
        });

        res.status(200).json({ status: 'ok' });

    } catch (error) {
        console.error('Impression recording error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/screens/:screenId/diagnostics
// Get detailed screen diagnostics for troubleshooting
// Auth: Retailer owner or Admin
router.get('/:screenId/diagnostics', requireAuth, async (req, res) => {
    try {
        const { screenId } = req.params;
        const screenDoc = await screensCollection.doc(screenId).get();

        if (!screenDoc.exists) {
            return res.status(404).json({ error: 'Screen not found' });
        }

        const screenData = screenDoc.data();

        if (req.user.role === 'retailer' && screenData.retailer_id !== req.user.linked_entity_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const lastSeen = new Date(screenData.last_seen || 0);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const isOnline = lastSeen > tenMinutesAgo;
        const status = isOnline ? 'online' : 'offline';
        const timeSinceHeartbeat = formatTimeSince(screenData.last_seen);

        const diagnostics = screenData.diagnostics || {};
        const suggestedActions = [];

        if (status === 'offline') {
            suggestedActions.push('check_wifi');
            if (diagnostics.wifi_strength && diagnostics.wifi_strength < -70) {
                suggestedActions.push('improve_wifi_signal');
            }
            suggestedActions.push('check_power');
            suggestedActions.push('restart_device');
            suggestedActions.push('contact_support');
        }

        const errorsSnapshot = await screensCollection
            .doc(screenId)
            .collection('errors')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        const recentErrors = [];
        errorsSnapshot.forEach(doc => {
            const errorData = doc.data();
            recentErrors.push({
                timestamp: errorData.timestamp,
                error: errorData.message || 'Unknown error',
                severity: errorData.severity || 'error'
            });
        });

        res.json({
            screen_id: screenData.screen_id,
            status,
            last_heartbeat: screenData.last_seen,
            time_since_heartbeat: timeSinceHeartbeat,
            diagnostics: {
                wifi_strength: diagnostics.wifi_strength || null,
                connection_quality: diagnostics.wifi_strength ?
                    (diagnostics.wifi_strength > -50 ? 'excellent' :
                        diagnostics.wifi_strength > -60 ? 'good' :
                            diagnostics.wifi_strength > -70 ? 'fair' : 'weak') : 'unknown',
                cpu_usage: diagnostics.cpu_usage || null,
                memory_usage: diagnostics.memory_usage || null,
                disk_space: diagnostics.disk_space || null,
                suggested_actions: suggestedActions
            },
            recent_errors: recentErrors,
            location: screenData.location || 'Unknown',
            location_id: screenData.location_id || null,
            retailer_id: screenData.retailer_id || null,
            resolution: screenData.resolution || 'Unknown',
            user_agent: screenData.user_agent || 'Unknown'
        });

    } catch (error) {
        console.error('Screen diagnostics error:', error);
        res.status(500).json({ error: 'Failed to fetch diagnostics' });
    }
});

export default router;
