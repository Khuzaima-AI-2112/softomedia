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
    // PLATFORM GOVERNANCE (Super Administrator)
    // ============================================

    async getDemoOrganizations() {
        return apiClient.get('/api/platform/organizations');
    }

    async createDemoOrganization(data) {
        return apiClient.post('/api/platform/organizations', data);
    }

    async updateDemoOrganization(id, data) {
        return apiClient.patch(`/api/platform/organizations/${id}`, data);
    }

    async getPlatformAuditRecords() {
        return apiClient.get('/api/platform/audit');
    }

    // ============================================
    // RETAILERS
    // ============================================

    async getRetailers() {
        return apiClient.get('/api/retailers');
    }

    /**
     * Fetch active retailers only — for use by Campaign Wizard and scheduler.
     * Calls GET /api/retailers?for=campaign, which filters status='active'
     * in addition to the standard deleted_at==null guard (S21-4).
     * Inactive retailers (deactivated via admin toggle) are excluded.
     * Do NOT use getRetailers() in campaign creation flows — use this method.
     */
    async getRetailersForCampaign() {
        return apiClient.get('/api/retailers?for=campaign');
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

    /**
     * Partial update for an advertiser — only overwrites supplied fields.
     * Use this for status toggles and field-level edits to avoid wiping
     * unrelated fields (the PUT route replaces the full document).
     */
    async patchAdvertiser(id, data) {
        return apiClient.patch(`/api/advertisers/${id}`, data);
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

    /**
     * Partial update for a store — e.g. status toggle.
     * @param {number|string} id
     * @param {object} data - Partial store fields.
     */
    async patchStore(id, data) {
        return apiClient.patch(`/api/stores/${id}`, data);
    }

    async deleteStore(id) {
        return apiClient.delete(`/api/stores/${id}`);
    }

    // ============================================
    // LOCATIONS
    // ============================================

    async getLocations(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.get(`/api/locations${query ? '?' + query : ''}`);
    }

    async createLocation(data) {
        return apiClient.post('/api/locations', data);
    }

    async deleteLocation(id) {
        return apiClient.delete(`/api/locations/${id}`);
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

    /**
     * Fetch all loops for a given calendar date.
     * Called by LoopManagement.jsx on date change and after generation.
     *
     * @param {string} date - ISO date string, e.g. '2026-06-05'
     * @returns {Promise<Array>} Array of loop objects with id, hour, status, slots, version, screen_ids
     */
    async getLoopsByDate(date) {
        return apiClient.get(`/api/loops?date=${date}`);
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

    /**
     * Generate loops for all business hours for a given date.
     * Called by the Generate Loops button in LoopManagement.jsx.
     *
     * @param {object} data - { target_date, retailer_id, store_id, mock? }
     * @returns {Promise<Array>} Newly created loop records
     */
    async generateLoops(data) {
        return apiClient.post('/api/loops/generate', data);
    }

    async replaceLoopSlot(loopId, position, assetId) {
        return apiClient.patch(`/api/loops/${loopId}/slots/${position}/replace`, { assetId });
    }

    async approveLoop(loopId) {
        return apiClient.post(`/api/loops/${loopId}/approve`);
    }

    // ============================================
    // CAMPAIGNS
    // ============================================

    async getBookableInventory() {
        return apiClient.get('/api/inventory');
    }

    async getCampaigns(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.get(`/api/campaigns${query ? '?' + query : ''}`);
    }

    async getCampaign(id) {
        return apiClient.get(`/api/campaigns/${id}`);
    }

    async getCampaignProofsOfPlay(id) {
        return apiClient.get(`/api/campaigns/${id}/proofs-of-play`);
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

    /**
     * Transition a campaign's approval status.
     * Calls PATCH /api/campaigns/:id/status
     *
     * @param {string} id     - Campaign ID
     * @param {string} status - Target status: 'approved' | 'rejected'
     * @returns {Promise<object>} Updated campaign object
     */
    async updateCampaignStatus(id, status) {
        return apiClient.patch(`/api/campaigns/${id}/status`, { status });
    }

    /**
     * Book ad slots for a campaign.
     * Calls POST /api/campaigns/:id/book — note: NOT /slots (Bug #S8-2 fix).
     * Body shape: { slots: [...] } as expected by the backend route handler.
     *
     * @param {string} campaignId
     * @param {Array}  slots      - Array of { loopId, slotIndex, creativeUrl, advertiser_id }
     * @returns {Promise<object>} Booking confirmation
     */
    async bookSlots(campaignId, slots) {
        return apiClient.post(`/api/campaigns/${campaignId}/book`, { slots });
    }

    // ============================================
    // ASSETS
    // ============================================

    async getAssets() {
        return apiClient.get('/api/assets');
    }

    async uploadAsset(formData) {
        return apiClient.postForm('/api/assets/upload', formData);
    }

    // ============================================
    // BUSINESS HOURS
    // ============================================

    async getWeeklyHours(storeId) {
        return apiClient.get(`/api/stores/${storeId}/weekly-hours`);
    }

    async updateWeeklyHours(storeId, data) {
        return apiClient.put(`/api/stores/${storeId}/weekly-hours`, { weekly_hours: data });
    }

    async listSpecialHours(storeId) {
        return apiClient.get(`/api/stores/${storeId}/special-hours`);
    }

    async updateSpecialHours(storeId, date, data) {
        return apiClient.put(`/api/stores/${storeId}/special-hours`, { date, ...data });
    }

    // ============================================
    // PRICING  (Sprint 15: /pricing/config endpoints)
    // ============================================

    /**
     * Get current CPM pricing configuration — Super Administrator only.
     * Backend: GET /api/pricing/config (authenticate + requireSuperAdmin).
     * Was previously wired to the public /api/pricing root stub; corrected in S15.
     *
     * @returns {Promise<object>} Pricing config document
     */
    async getPricingConfig() {
        return apiClient.get('/api/pricing/config');
    }

    /**
     * Update CPM pricing configuration — Super Administrator only.
     * Backend: PUT /api/pricing/config (authenticate + requireSuperAdmin).
     * Also validates allocation sum server-side; client enforces the same rule.
     *
     * @param {object} data - { cpm_rates: {}, allocation: { paid, retailer, internal } }
     * @returns {Promise<object>} Updated config document
     */
    async updatePricingConfig(data) {
        return apiClient.put('/api/pricing/config', data);
    }

    async getAuditLogs() {
        return apiClient.get('/api/audit');
    }

    // ============================================
    // GENERIC REQUEST (used by Invoices.jsx)
    // ============================================

    /**
     * Generic HTTP request wrapper.
     * Useful for feature pages that call one-off endpoints without
     * needing a dedicated method.
     *
     * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
     * @param {string} path   - Relative path, e.g. '/invoices'
     * @param {object} [body] - Optional request body
     * @returns {Promise<object>}
     */
    async request(method, path, body) {
        const url = `/api${path}`;
        switch (method.toUpperCase()) {
            case 'GET': return apiClient.get(url);
            case 'POST': return apiClient.post(url, body);
            case 'PUT': return apiClient.put(url, body);
            case 'PATCH': return apiClient.patch(url, body);
            case 'DELETE': return apiClient.delete(url);
            default: throw new Error(`Unsupported method: ${method}`);
        }
    }

    // ============================================
    // OBSERVABILITY
    // ============================================

    /**
     * Report a caught UI error to the backend observability endpoint.
     * Called by ErrorBoundary.componentDidCatch.
     *
     * This method must never throw — ErrorBoundary already has hasError=true
     * and a secondary failure here would be swallowed silently anyway.
     *
     * @param {Error}  error          - The caught error object.
     * @param {string} componentStack - React component stack from errorInfo.
     */
    async reportError(error, componentStack) {
        try {
            const payload = {
                message: error?.message || String(error),
                stack: error?.stack || null,
                componentStack: componentStack || null,
                href: window.location.href,
                timestamp: new Date().toISOString(),
            };
            console.error('[ErrorBoundary] Reporting UI error:', payload);
            await apiClient.post('/api/logs/error', payload);
        } catch {
            // Intentionally silent — logging failures must not cascade.
        }
    }
}

const apiService = new ApiService();
export default apiService;
