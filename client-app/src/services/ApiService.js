/**
 * ApiService - Unified Backend Communication Layer
 * Replaces LocalStorageService by proxying requests to the ad-server API
 */

import apiClient from './api';

class ApiService {
    // ============================================
    // RETAILERS
    // ============================================

    async getRetailers() {
        return apiClient.get('/api/retailers');
    }

    async getRetailer(id) {
        return apiClient.get(`/api/retailers/${id}`);
    }

    async createRetailer(data) {
        return apiClient.post('/api/retailers', data);
    }

    async updateRetailer(id, data) {
        return apiClient.put(`/api/retailers/${id}`, data);
    }

    async deleteRetailer(id) {
        return apiClient.delete(`/api/retailers/${id}`);
    }

    // ============================================
    // STORES
    // ============================================

    async getStores(retailerId = null) {
        const url = retailerId ? `/api/stores?retailerId=${retailerId}` : '/api/stores';
        return apiClient.get(url);
    }

    async getStore(id) {
        return apiClient.get(`/api/stores/${id}`);
    }

    async createStore(data) {
        return apiClient.post('/api/stores', data);
    }

    async updateStore(id, data) {
        return apiClient.put(`/api/stores/${id}`, data);
    }

    async deleteStore(id) {
        return apiClient.delete(`/api/stores/${id}`);
    }

    async getEffectiveHours(storeId, date) {
        return apiClient.get(`/api/stores/${storeId}/hours?date=${date}`);
    }

    async getWeeklyHours(storeId) {
        return apiClient.get(`/api/stores/${storeId}/weekly-hours`);
    }

    async updateWeeklyHours(storeId, weeklyHours) {
        return apiClient.put(`/api/stores/${storeId}/weekly-hours`, { weekly_hours: weeklyHours });
    }

    async updateSpecialHours(storeId, date, hoursData) {
        return apiClient.put(`/api/stores/${storeId}/special-hours`, { date, ...hoursData });
    }

    async listSpecialHours(storeId) {
        return apiClient.get(`/api/stores/${storeId}/special-hours`);
    }

    // ============================================
    // SCREENS
    // ============================================

    async getScreens(filters = {}) {
        let url = '/api/screens';
        const params = new URLSearchParams();
        if (filters.retailerId) params.append('retailerId', filters.retailerId);
        if (filters.storeId) params.append('storeId', filters.storeId);
        if (filters.status) params.append('status', filters.status);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        return apiClient.get(url);
    }

    async getScreen(id) {
        return apiClient.get(`/api/screens/${id}`);
    }

    // ============================================
    // ADVERTISERS
    // ============================================

    async getAdvertisers() {
        return apiClient.get('/api/advertisers');
    }

    async getAdvertiser(id) {
        return apiClient.get(`/api/advertisers/${id}`);
    }

    async createAdvertiser(data) {
        return apiClient.post('/api/advertisers', data);
    }

    async updateAdvertiser(id, data) {
        return apiClient.put(`/api/advertisers/${id}`, data);
    }

    async deleteAdvertiser(id) {
        return apiClient.delete(`/api/advertisers/${id}`);
    }

    // ============================================
    // ADS
    // ============================================

    async getAds(filters = {}) {
        const params = new URLSearchParams();
        if (filters.campaign_id) params.append('campaign_id', filters.campaign_id);
        if (filters.status) params.append('status', filters.status);
        if (filters.limit) params.append('limit', filters.limit);
        const qs = params.toString();
        return apiClient.get(`/api/ads${qs ? `?${qs}` : ''}`);
    }

    async getAd(id) {
        return apiClient.get(`/api/ads/${id}`);
    }

    async reviewAd(id, status, rejection_reason = null) {
        return apiClient.put(`/api/ads/${id}/review`, { status, rejection_reason });
    }

    async deleteAd(id) {
        return apiClient.delete(`/api/ads/${id}`);
    }

    // ============================================
    // USERS
    // ============================================

    async getUsers() {
        return apiClient.get('/api/users');
    }

    async getUser(id) {
        return apiClient.get(`/api/users/${id}`);
    }

    async getUsersByRole(role) {
        return apiClient.get(`/api/users?role=${role}`);
    }

    async createUser(data) {
        return apiClient.post('/api/users', data);
    }

    async updateUser(id, data) {
        return apiClient.put(`/api/users/${id}`, data);
    }

    // ============================================
    // CAMPAIGNS & BOOKING
    // ============================================

    async getCampaigns(advertiserId = null) {
        const url = advertiserId ? `/api/campaigns?advertiserId=${advertiserId}` : '/api/campaigns';
        return apiClient.get(url);
    }

    async getCampaign(id) {
        return apiClient.get(`/api/campaigns/${id}`);
    }

    async updateCampaignStatus(id, status) {
        return apiClient.patch(`/api/campaigns/${id}/status`, { status });
    }

    async createCampaign(data) {
        return apiClient.post('/api/campaigns', data);
    }

    async bookSlots(campaignId, slots) {
        return apiClient.post(`/api/campaigns/${campaignId}/book`, { slots });
    }

    // ============================================
    // LOOPS
    // ============================================

    async getLoops(filters = {}) {
        let url = '/api/loops';
        const params = new URLSearchParams();
        if (filters.date) params.append('date', filters.date);
        if (filters.screenId) params.append('screenId', filters.screenId);
        if (filters.retailerId) params.append('retailerId', filters.retailerId);
        if (filters.locationId) params.append('location_id', filters.locationId);
        if (filters.location_id) params.append('location_id', filters.location_id);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        return apiClient.get(url);
    }

    async getLoopByParams(screenId, date, hour) {
        const data = await apiClient.get(`/api/loops?screenId=${screenId}&date=${date}&hour=${hour}`);
        const loops = data.loops || (Array.isArray(data) ? data : []);
        return loops[0];
    }

    async getLoop(id) {
        return apiClient.get(`/api/loops/${id}`);
    }

    async replaceLoopSlot(loopId, position, assetId) {
        return apiClient.patch(`/api/loops/${loopId}/slots/${position}/replace`, { assetId });
    }

    async approveLoop(loopId, userId = 'admin_demo') {
        return apiClient.patch(`/api/loops/${loopId}/approve`, { userId });
    }

    async getLoopsByDate(date) {
        return apiClient.get(`/api/loops?date=${date}`);
    }

    async generateLoops(data) {
        return apiClient.post('/api/loops/generate', data);
    }

    // ============================================
    // PRICING
    // ============================================

    async getPricingConfig() {
        const data = await apiClient.get('/api/pricing/config');
        return this._normalizePricingConfig(data);
    }

    async updatePricingConfig(data) {
        const updated = await apiClient.put('/api/pricing/config', data);
        return this._normalizePricingConfig(updated);
    }

    _normalizePricingConfig(config) {
        if (!config) return null;
        return {
            ...config,
            baseCPM: config.baseCPM || config.base_cpm || 15.00,
            trafficTiers: config.trafficTiers || config.traffic_tiers || {},
            dateOverrides: config.dateOverrides || config.date_overrides || {},
            retailerOverrides: config.retailerOverrides || config.retailer_overrides || {}
        };
    }

    async calculatePrice(hour, screenId = null) {
        const url = screenId
            ? `/api/pricing/calculate?hour=${hour}&screenId=${screenId}`
            : `/api/pricing/calculate?hour=${hour}`;
        return apiClient.get(url);
    }

    // ============================================
    // PLAYLISTS
    // ============================================

    async getPlaylists() {
        return apiClient.get('/api/playlists');
    }

    async getPlaylist(id) {
        return apiClient.get(`/api/playlists/${id}`);
    }

    async createPlaylist(data) {
        return apiClient.post('/api/playlists', data);
    }

    async updatePlaylist(id, data) {
        return apiClient.put(`/api/playlists/${id}`, data);
    }

    async deletePlaylist(id) {
        return apiClient.delete(`/api/playlists/${id}`);
    }

    // ============================================
    // ASSETS
    // ============================================

    async getAssets() {
        return apiClient.get('/api/assets');
    }

    async uploadAsset(formData) {
        return apiClient.post('/api/assets/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }

    // ============================================
    // LOCATIONS
    // ============================================

    async getLocations() {
        return apiClient.get('/api/locations');
    }

    async createLocation(data) {
        return apiClient.post('/api/locations', data);
    }

    async deleteLocation(id) {
        return apiClient.delete(`/api/locations/${id}`);
    }

    async getAuditLogs(filters = {}) {
        let url = '/api/audit';
        const params = new URLSearchParams();
        if (filters.locationId) params.append('locationId', filters.locationId);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        return apiClient.get(url);
    }

    // ============================================
    // ADDITIONAL SCREEN OPS
    // ============================================

    async registerScreen(data) {
        return apiClient.post('/api/screens/register', data);
    }

    async deleteScreen(id) {
        return apiClient.delete(`/api/screens/${id}`);
    }

    // ============================================
    // TELEMETRY & OBSERVABILITY
    // ============================================

    async reportError(error, componentStack = null) {
        // Safe wrapper to prevent error reporting from causing errors
        try {
            const payload = {
                message: error.message || String(error),
                stack: error.stack,
                componentStack,
                url: window.location.href,
                userAgent: navigator.userAgent
            };
            // Fire and forget
            apiClient.post('/api/telemetry/error', payload).catch(e => console.error('Failed to report error:', e));
        } catch (e) {
            console.error('Error reporting failed:', e);
        }
    }
}


const apiService = new ApiService();
export default apiService;
