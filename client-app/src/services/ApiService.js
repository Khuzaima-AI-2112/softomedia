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

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const data = await apiClient.get(url);
        // Backend returns { loops: [], business_hours: {} }
        return data.loops || data;
    }

    async getLoopByParams(screenId, date, hour) {
        const data = await apiClient.get(`/api/loops?screenId=${screenId}&date=${date}&hour=${hour}`);
        const loops = data.loops || data;
        return Array.isArray(loops) ? loops[0] : loops;
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
        const data = await apiClient.get(`/api/loops?date=${date}`);
        // Backend returns { loops: [], business_hours: {} }
        return data.loops || data;
    }

    async generateLoops(data) {
        return apiClient.post('/api/loops/generate', data);
    }

    // ============================================
    // PRICING
    // ============================================

    async getPricingConfig() {
        return apiClient.get('/api/pricing/config');
    }

    async updatePricingConfig(data) {
        return apiClient.put('/api/pricing/config', data);
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
}

const apiService = new ApiService();
export default apiService;
