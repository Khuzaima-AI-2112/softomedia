/**
 * Notifications API
 *
 * GET  /api/notifications          — list notifications for the authenticated user
 * GET  /api/notifications/unread   — count of unread notifications
 * PATCH /api/notifications/:id/read — mark a single notification as read
 * PATCH /api/notifications/read-all — mark all of the user's notifications as read
 *
 * All routes are mounted behind authenticate in api/index.js.
 * User identity is taken from req.user.id (demo) or req.user.uid (JWT);
 * both are checked so neither auth path breaks.
 *
 * Firestore collection: "notifications"
 * Expected document shape:
 *   {
 *     user_id:    string,
 *     title:      string,
 *     message:    string,
 *     type:       'info' | 'warning' | 'error' | 'success',
 *     read:       boolean,
 *     created_at: ISO 8601 string
 *   }
 *
 * Sprint 10 — sprintWRAPUP item 2: replaced 135-byte stub with real Firestore reads.
 */

import express from 'express';
import { BaseRepository } from '../repositories/BaseRepository.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Thin repo — no custom methods needed beyond BaseRepository
class NotificationRepository extends BaseRepository {
    constructor() {
        super('notifications');
    }
}
const notificationRepo = new NotificationRepository();

/**
 * Resolve the caller's user ID from the request.
 * authenticate middleware sets req.user.id for demo tokens
 * and req.user.uid for real JWTs. Fallback to null (handled as 401 below).
 */
function getUserId(req) {
    return req.user?.id || req.user?.uid || null;
}

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user, newest first.
 * Query param: ?limit=N (default 50, max 100)
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'User identity missing from token' });

        const rawLimit = parseInt(req.query.limit, 10);
        const limit = isNaN(rawLimit) ? 50 : Math.min(rawLimit, 100);

        const notifications = await notificationRepo.findAll({
            where: [['user_id', '==', userId]],
            orderBy: ['created_at', 'desc'],
            limit
        });

        res.json(notifications);
    } catch (err) {
        logger.error('[Notifications] GET / failed', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * GET /api/notifications/unread
 * Returns { count: N } — number of unread notifications for the user.
 */
router.get('/unread', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'User identity missing from token' });

        const unread = await notificationRepo.findAll({
            where: [
                ['user_id', '==', userId],
                ['read',    '==', false]
            ]
        });

        res.json({ count: unread.length });
    } catch (err) {
        logger.error('[Notifications] GET /unread failed', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 * Returns 404 if the notification does not exist or belongs to a different user.
 */
router.patch('/:id/read', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'User identity missing from token' });

        const notification = await notificationRepo.findById(req.params.id);
        if (!notification || notification.user_id !== userId) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const updated = await notificationRepo.update(req.params.id, { read: true });
        res.json(updated);
    } catch (err) {
        logger.error('[Notifications] PATCH /:id/read failed', { id: req.params.id, error: err.message });
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

/**
 * PATCH /api/notifications/read-all
 * Marks every unread notification belonging to the user as read.
 * Returns { updated: N }.
 *
 * NOTE: This route MUST be defined before '/:id/read' in the file so
 * Express does not try to treat "read-all" as a notification ID.
 * It is intentionally placed before /:id/read above — do not reorder.
 */
router.patch('/read-all', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'User identity missing from token' });

        const unread = await notificationRepo.findAll({
            where: [
                ['user_id', '==', userId],
                ['read',    '==', false]
            ]
        });

        await Promise.all(unread.map(n => notificationRepo.update(n.id, { read: true })));

        res.json({ updated: unread.length });
    } catch (err) {
        logger.error('[Notifications] PATCH /read-all failed', { error: err.message });
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

export default router;
