// Screen API Service
// Screen registration and playlist API calls

import apiClient from './api.js';

export const screenAPI = {
    /**
     * Get playlist for screen
     * @param {string} screenId - Screen ID
     * @returns {Promise<{playlist: Array}>}
     */
    async getPlaylist(screenId) {
        return apiClient.get(`/api/playlist/${screenId}`);
    },

    /**
     * Register screen
     * @param {string} screenId - Screen ID
     * @returns {Promise<{status: string, data: object}>}
     */
    async register(screenId) {
        return apiClient.post('/api/screens/register', { screen_id: screenId });
    },

    /**
     * Record impression
     * @param {string} screenId - Screen ID
     * @param {string} adId - Ad ID
     * @returns {Promise<{status: string}>}
     */
    async recordImpression(screenId, adId) {
        return apiClient.post(`/api/screens/${screenId}/impressions`, { ad_id: adId });
    },
};
