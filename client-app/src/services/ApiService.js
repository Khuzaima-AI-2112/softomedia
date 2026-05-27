import apiClient from './api';

class ApiService {
    // ============================================
    // USERS
    // ============================================

    async getUsers() {
        return apiClient.get('/api/users');
    }

    async getUser(id) {
        return apiClient.get(`/api/users/${id}`);
    }

    async createUser(data) {
        return apiClient.post('/api/users', data);
    }

    async updateUser(id, data) {
        return apiClient.put(`/api/users/${id}`, data);
    }

    async deleteUser(id) {
        return apiClient.delete(`/api/users/${id}`);
    }

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

    async patchRetailer(id, data) {
        return apiClient.patch(`/api/retailers/${id}`, data);
    }

    async deleteRetailer(id) {
        return apiClient.delete(`/api/retailers/${id}`);
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
    // STORES
    // ============================================

    async getStores(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.get(`/api/stores${query ? '?' + query : ''}`);
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

    // ============================================
    // SCREENS
    // ============================================

    async getScreens(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.get(`/api/screens${query ? '?' + query : ''}`);
    }

    async getScreen(id) {
        return apiClient.get(`/api/screens/${id}`);
    }

    async createScreen(data) {
        return apiClient.post('/api/screens', data);
    }

    async updateScreen(id, data) {
        return apiClient.put(`/api/screens/${id}`, data);
    }

    async patchScreen(id, data) {
        return apiClient.patch(`/api/screens/${id}`, data);
    }

    /**
     * Dedicated status update for a screen.
     * Sends PATCH /api/screens/:id/status { status: 'active' | 'inactive' }.
     *
     * The backend is expected to:
     *  - Validate that status is one of the allowed values.
     *  - Check for active / upcoming campaigns before allowing active → inactive.
     *  - On conflict return { error: 'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS', message: '...' }.
     *
     * @param {number|string} id     - Screen numeric DB id.
     * @param {'active'|'inactive'} status
     * @returns {Promise<object>} Updated screen object.
     */
    async updateScreenStatus(id, status) {
        return apiClient.patch(`/api/screens/${id}/status`, { status });
    }

    async deleteScreen(id) {
        return apiClient.delete(`/api/screens/${id}`);
    }

    // ============================================
    // LOOPS
    // ============================================

    async getLoops(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.get(`/api/loops${query ? '?' + query : ''}`);
    }

    async getLoop(id) {
        return apiClient.get(`/api/loops/${id}`);
    }

    async createLoop(data) {
        return apiClient.post('/api/loops', data);
    }

    async updateLoop(id, data) {
        return apiClient.put(`/api/loops/${id}`, data);
    }

    async deleteLoop(id) {
        return apiClient.delete(`/api/loops/${id}`);
    }

    // ============================================
    // CAMPAIGNS
    // ============================================

    async getCampaigns(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.get(`/api/campaigns${query ? '?' + query : ''}`);
    }

    async getCampaign(id) {
        return apiClient.get(`/api/campaigns/${id}`);
    }

    async createCampaign(data) {
        return apiClient.post('/api/campaigns', data);
    }

    async updateCampaign(id, data) {
        return apiClient.put(`/api/campaigns/${id}`, data);
    }

    async deleteCampaign(id) {
        return apiClient.delete(`/api/campaigns/${id}`);
    }

    async bookSlots(campaignId, slots) {
        return apiClient.post(`/api/campaigns/${campaignId}/slots`, slots);
    }

    // ============================================
    // BUSINESS HOURS
    // ============================================

    async getWeeklyHours(storeId) {
        return apiClient.get(`/api/stores/${storeId}/hours`);
    }

    async updateWeeklyHours(storeId, data) {
        return apiClient.put(`/api/stores/${storeId}/hours`, data);
    }

    async listSpecialHours(storeId) {
        return apiClient.get(`/api/stores/${storeId}/hours/special`);
    }

    async updateSpecialHours(storeId, date, data) {
        return apiClient.put(`/api/stores/${storeId}/hours/special/${date}`, data);
    }

    // ============================================
    // PRICING
    // ============================================

    async getPricingConfig() {
        return apiClient.get('/api/pricing');
    }

    async updatePricingConfig(data) {
        return apiClient.put('/api/pricing', data);
    }
}

const apiService = new ApiService();
export default apiService;
