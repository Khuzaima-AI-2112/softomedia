import { screenRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';

export class HeartbeatService {
    /**
     * Record a heartbeat for a screen
     * @param {string} screenId 
     * @returns {Promise<void>}
     */
    async recordHeartbeat(screenId) {
        try {
            await screenRepository.updateHeartbeat(screenId);
        } catch (error) {
            logger.error('Failed to record heartbeat', { screenId, error: error.message });
        }
    }

    /**
     * Check for offline screens (timeout = 2 minutes)
     * @returns {Promise<Array>} List of screens that just went offline
     */
    async checkScreenHealth() {
        try {
            const allScreens = await screenRepository.findAll();
            const now = new Date();
            const timeoutMs = 2 * 60 * 1000; // 2 minutes

            const offlineScreens = [];

            for (const screen of allScreens) {
                if (!screen.last_seen) continue;

                const lastSeenDate = new Date(screen.last_seen);
                if (now - lastSeenDate > timeoutMs && screen.status !== 'OFFLINE') {
                    await screenRepository.update(screen.id, { status: 'OFFLINE' });
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
