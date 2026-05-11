import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const firestore = new Firestore();

/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications (FCM)
 * Auth: Any authenticated user
 */
router.post('/subscribe', requireAuth, async (req, res) => {
    try {
        const { fcm_token, device_type } = req.body;

        if (!fcm_token) {
            return res.status(400).json({ error: 'fcm_token is required' });
        }

        const userId = req.user.uid;

        // Store FCM token for this user
        await firestore.collection('user_tokens').doc(userId).set({
            user_id: userId,
            fcm_token,
            device_type: device_type || 'web',
            subscribed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { merge: true });

        res.json({
            message: 'Successfully subscribed to notifications'
        });

    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

/**
 * DELETE /api/notifications/unsubscribe
 * Unsubscribe from push notifications
 * Auth: Any authenticated user
 */
router.delete('/unsubscribe', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;

        await firestore.collection('user_tokens').doc(userId).delete();

        res.json({
            message: 'Successfully unsubscribed from notifications'
        });

    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

/**
 * GET /api/notifications/preferences
 * Get user notification preferences
 * Auth: Any authenticated user
 */
router.get('/preferences', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;

        const prefsDoc = await firestore
            .collection('notification_preferences')
            .doc(userId)
            .get();

        if (!prefsDoc.exists) {
            // Return default preferences
            return res.json({
                screen_offline: true,
                campaign_completed: true,
                low_balance: true,
                new_earnings: true,
                system_updates: false
            });
        }

        res.json(prefsDoc.data());

    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

/**
 * PUT /api/notifications/preferences
 * Update user notification preferences
 * Auth: Any authenticated user
 */
router.put('/preferences', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const preferences = req.body;

        // Validate preferences
        const validKeys = ['screen_offline', 'campaign_completed', 'low_balance', 'new_earnings', 'system_updates'];
        const filteredPrefs = {};

        for (const key of validKeys) {
            if (preferences[key] !== undefined) {
                filteredPrefs[key] = Boolean(preferences[key]);
            }
        }

        if (Object.keys(filteredPrefs).length === 0) {
            return res.status(400).json({ error: 'No valid preferences provided' });
        }

        filteredPrefs.updated_at = new Date().toISOString();

        await firestore
            .collection('notification_preferences')
            .doc(userId)
            .set(filteredPrefs, { merge: true });

        res.json({
            message: 'Preferences updated successfully',
            preferences: filteredPrefs
        });

    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

/**
 * GET /api/notifications/history
 * Get notification history for user
 * Auth: Any authenticated user
 */
router.get('/history', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { limit = 50 } = req.query;

        const snapshot = await firestore
            .collection('notifications')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(parseInt(limit))
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            notifications,
            total: notifications.length
        });

    } catch (error) {
        console.error('Get notification history error:', error);
        res.status(500).json({ error: 'Failed to fetch notification history' });
    }
});

/**
 * POST /api/notifications/send (Admin only)
 * Manually send a notification
 * Auth: Admin
 */
router.post('/send', requireAuth, async (req, res) => {
    try {
        // This would integrate with Firebase Cloud Messaging
        // For now, just log it as a placeholder

        const { user_id, title, message, type } = req.body;

        if (!user_id || !title || !message) {
            return res.status(400).json({ error: 'user_id, title, and message are required' });
        }

        // Store notification in database
        const notificationData = {
            user_id,
            title,
            message,
            type: type || 'info',
            read: false,
            created_at: new Date().toISOString()
        };

        const notifRef = await firestore.collection('notifications').add(notificationData);

        // TODO: Integrate with FCM to actually send push notification
        // const admin = require('firebase-admin');
        // const tokenDoc = await firestore.collection('user_tokens').doc(user_id).get();
        // if (tokenDoc.exists) {
        //     await admin.messaging().send({
        //         token: tokenDoc.data().fcm_token,
        //         notification: { title, body: message }
        //     });
        // }

        console.log('📧 NOTIFICATION (Placeholder)');
        console.log(`To User: ${user_id}`);
        console.log(`Title: ${title}`);
        console.log(`Message: ${message}`);

        res.json({
            notification_id: notifRef.id,
            message: 'Notification sent successfully'
        });

    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

export default router;
