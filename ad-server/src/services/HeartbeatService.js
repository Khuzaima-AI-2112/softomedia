import { screenRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

export class HeartbeatService {
    constructor({ repository = screenRepository, clock = () => new Date() } = {}) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Record a heartbeat for a screen
     * @param {string} screenId 
     * @returns {Promise<void>}
     */
    async recordHeartbeat(screenId, now = this.clock()) {
        const screen = await this.repository.findById(screenId);
        if (!screen) throw new Error('Screen not found');
        return this.repository.updateHeartbeat(screenId, 'ONLINE', now);
    }

    /**
     * Check for offline screens (timeout = 2 minutes)
     * @returns {Promise<Array>} List of screens that just went offline
     */
    async checkScreenHealth(now = this.clock()) {
        try {
            const allScreens = await this.repository.findAll();
            const timeoutMs = 2 * 60 * 1000; // 2 minutes

            const offlineScreens = [];

            for (const screen of allScreens) {
                if (!screen.last_seen) continue;

                const lastSeenDate = new Date(screen.last_seen);
                if (now - lastSeenDate >= timeoutMs && screen.status !== 'OFFLINE') {
                    await this.repository.update(screen.id, { status: 'OFFLINE' });
                    offlineScreens.push(screen.id);
                    logger.warn('Screen marked OFFLINE due to timeout', { screenId: screen.id });
                }
            }

            return offlineScreens;
        } catch (error) {
            logger.error('Health check failed', { error: error.message });
            return [];
        }
    }
}

export const heartbeatService = new HeartbeatService();
