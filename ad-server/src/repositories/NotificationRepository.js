import { randomUUID } from 'node:crypto';
import { BaseRepository } from './BaseRepository.js';

/** In-app notifications, read through /api/notifications. */
export class NotificationRepository extends BaseRepository {
    constructor() {
        super('notifications');
    }

    /**
     * Sends a user an unread in-app notification.
     * @param {string} userId
     * @param {{title: string, message: string, type?: 'info'|'warning'|'error'|'success'}} notification
     */
    notify(userId, { title, message, type = 'info' }) {
        return this.create(`ntf_${randomUUID()}`, {
            user_id: userId,
            title,
            message,
            type,
            read: false,
            created_at: new Date().toISOString(),
        });
    }
}

export const notificationRepository = new NotificationRepository();
export default notificationRepository;
