/**
 * notifications.js — Sprint 10
 *
 * FCM send is now fully wired (no more console.log placeholder).
 * GET /history now supports cursor-based pagination.
 * POST /mark-read marks a single notification or all as read.
 * POST /send validates admin role and dispatches via FCM.
 */

import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

function db() { return getFirestore(); }

// ── POST /subscribe ──────────────────────────────────────────────────────────
router.post('/subscribe', requireAuth, async (req, res) => {
    try {
        const { fcm_token, device_type } = req.body;
        if (!fcm_token) return res.status(400).json({ error: 'fcm_token is required' });

        await db().collection('user_tokens').doc(req.user.uid).set({
            user_id: req.user.uid,
            fcm_token,
            device_type: device_type || 'web',
            subscribed_at: new Date().toISOString(),
            updated_at:    new Date().toISOString(),
        }, { merge: true });

        res.json({ message: 'Successfully subscribed to notifications' });
    } catch (error) {
        logger.error('Subscribe error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

// ── DELETE /unsubscribe ───────────────────────────────────────────────────────
router.delete('/unsubscribe', requireAuth, async (req, res) => {
    try {
        await db().collection('user_tokens').doc(req.user.uid).delete();
        res.json({ message: 'Successfully unsubscribed from notifications' });
    } catch (error) {
        logger.error('Unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

// ── GET /preferences ─────────────────────────────────────────────────────────
router.get('/preferences', requireAuth, async (req, res) => {
    try {
        const doc = await db().collection('notification_preferences').doc(req.user.uid).get();
        res.json(doc.exists ? doc.data() : {
            screen_offline:     true,
            campaign_completed: true,
            low_balance:        true,
            new_earnings:       true,
            system_updates:     false,
        });
    } catch (error) {
        logger.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

// ── PUT /preferences ─────────────────────────────────────────────────────────
router.put('/preferences', requireAuth, async (req, res) => {
    try {
        const validKeys = ['screen_offline','campaign_completed','low_balance','new_earnings','system_updates'];
        const filtered  = {};
        for (const k of validKeys) {
            if (req.body[k] !== undefined) filtered[k] = Boolean(req.body[k]);
        }
        if (!Object.keys(filtered).length) return res.status(400).json({ error: 'No valid preferences provided' });

        filtered.updated_at = new Date().toISOString();
        await db().collection('notification_preferences').doc(req.user.uid).set(filtered, { merge: true });
        res.json({ message: 'Preferences updated successfully', preferences: filtered });
    } catch (error) {
        logger.error('Update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// ── GET /history ─────────────────────────────────────────────────────────────
// Supports cursor pagination via ?after=<last_doc_id>
router.get('/history', requireAuth, async (req, res) => {
    try {
        const { limit = '30', after } = req.query;
        const pageSize = Math.min(parseInt(limit) || 30, 100);

        let q = db().collection('notifications')
            .where('user_id', '==', req.user.uid)
            .orderBy('created_at', 'desc')
            .limit(pageSize + 1);

        if (after) {
            const cursorDoc = await db().collection('notifications').doc(after).get();
            if (cursorDoc.exists) q = q.startAfter(cursorDoc);
        }

        const snap   = await q.get();
        const docs   = snap.docs.slice(0, pageSize);
        const hasMore = snap.docs.length > pageSize;

        res.json({
            notifications: docs.map(d => ({ id: d.id, ...d.data() })),
            hasMore,
            nextCursor: hasMore ? docs[docs.length - 1].id : null,
            unreadCount: docs.filter(d => !d.data().read).length,
        });
    } catch (error) {
        logger.error('Get notification history error:', error);
        res.status(500).json({ error: 'Failed to fetch notification history' });
    }
});

// ── POST /mark-read ───────────────────────────────────────────────────────────
// Body: { id?: string }  — omit id to mark all as read
router.post('/mark-read', requireAuth, async (req, res) => {
    try {
        const { id } = req.body;
        const firestore = db();

        if (id) {
            const ref = firestore.collection('notifications').doc(id);
            const doc = await ref.get();
            if (!doc.exists || doc.data().user_id !== req.user.uid) {
                return res.status(404).json({ error: 'Notification not found.' });
            }
            await ref.update({ read: true });
        } else {
            // Mark all unread for this user
            const snap = await firestore.collection('notifications')
                .where('user_id', '==', req.user.uid)
                .where('read', '==', false)
                .get();

            const batch = firestore.batch();
            snap.docs.forEach(d => batch.update(d.ref, { read: true }));
            await batch.commit();
        }

        res.json({ message: 'Marked as read' });
    } catch (error) {
        logger.error('Mark-read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// ── POST /send (admin only) ───────────────────────────────────────────────────
router.post('/send', requireAuth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const { user_id, title, message, type = 'info' } = req.body;
        if (!user_id || !title || !message) {
            return res.status(400).json({ error: 'user_id, title, and message are required.' });
        }

        const firestore = db();

        // Persist to Firestore
        const payload = {
            user_id, title, message,
            type, read: false,
            created_at: new Date().toISOString(),
        };
        const notifRef = await firestore.collection('notifications').add(payload);

        // Dispatch FCM push if the user has a registered token
        const tokenDoc = await firestore.collection('user_tokens').doc(user_id).get();
        if (tokenDoc.exists) {
            const { fcm_token } = tokenDoc.data();
            try {
                await getMessaging().send({
                    token: fcm_token,
                    notification: { title, body: message },
                    data: { notification_id: notifRef.id, type },
                });
            } catch (fcmErr) {
                // Token may be stale — log but don't fail the request
                logger.warn(`FCM dispatch failed for user ${user_id}:`, fcmErr.message);
            }
        }

        res.json({ notification_id: notifRef.id, message: 'Notification sent successfully' });
    } catch (error) {
        logger.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

export default router;
