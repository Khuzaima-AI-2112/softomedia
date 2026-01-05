/**
 * LocalStorageService - Centralized Data Persistence Layer
 * Manages all platform data in localStorage for the MVP prototype
 * 
 * Data Schemas:
 * - retailers: Retail partner organizations
 * - stores: Physical store locations
 * - screens: Digital screens in stores
 * - advertisers: Brand/agency accounts
 * - campaigns: Advertising campaigns
 * - loops: Hourly broadcast loops (12 slots each)
 * - slots: Individual 5-second ad slots
 * - users: Platform users with roles
 * - pricingConfig: CPM pricing configuration
 * - validationQueue: Pending retailer approvals
 * - auditLog: Action history
 */

const STORAGE_PREFIX = 'softomedia_';
const STORAGE_VERSION = '1.0.0';

// Business hours configuration
const BUSINESS_HOURS = {
    START: 8,
    END: 22 // 10 PM (exclusive, so 8am-9pm = 14 hours)
};

// Traffic tiers with hour mappings
const DEFAULT_TRAFFIC_TIERS = {
    veryLow: { multiplier: 0.5, label: 'Very Low', color: '#94a3b8', hours: [8, 9, 20, 21] },
    low: { multiplier: 0.75, label: 'Low', color: '#60a5fa', hours: [10, 11, 19] },
    medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
    high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
};

class LocalStorageService {
    constructor() {
        this.initialized = false;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    init() {
        if (this.initialized) return;

        const version = this._get('version');
        if (version !== STORAGE_VERSION) {
            this._seedData();
            this._set('version', STORAGE_VERSION);
        }
        this.initialized = true;
    }

    reset() {
        // Clear all softomedia data
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        this.initialized = false;
        this.init();
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    _get(key) {
        const data = localStorage.getItem(STORAGE_PREFIX + key);
        return data ? JSON.parse(data) : null;
    }

    _set(key, value) {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    }

    _generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ============================================
    // SEED DATA
    // ============================================

    _seedData() {
        // Seed Retailers
        const retailers = [
            {
                id: 'ret_001',
                name: 'Metro Supermarkets',
                logo: '🛒',
                contactEmail: 'admin@metrosuper.com',
                status: 'active',
                contractStart: '2025-01-01',
                createdAt: '2025-01-01T00:00:00Z'
            },
            {
                id: 'ret_002',
                name: 'FreshMart Express',
                logo: '🥬',
                contactEmail: 'ops@freshmart.com',
                status: 'active',
                contractStart: '2025-03-15',
                createdAt: '2025-03-15T00:00:00Z'
            },
            {
                id: 'ret_003',
                name: 'QuickStop Convenience',
                logo: '⚡',
                contactEmail: 'manager@quickstop.com',
                status: 'active',
                contractStart: '2025-06-01',
                createdAt: '2025-06-01T00:00:00Z'
            }
        ];
        this._set('retailers', retailers);

        // Seed Stores
        const stores = [
            // Metro Supermarkets (15 stores)
            { id: 'str_001', retailerId: 'ret_001', name: 'Metro Downtown', address: '123 Main St, NYC', city: 'New York', screenCount: 4, trafficLevel: 'high', status: 'active' },
            { id: 'str_002', retailerId: 'ret_001', name: 'Metro Midtown', address: '456 5th Ave, NYC', city: 'New York', screenCount: 3, trafficLevel: 'high', status: 'active' },
            { id: 'str_003', retailerId: 'ret_001', name: 'Metro Brooklyn', address: '789 Atlantic Ave, Brooklyn', city: 'Brooklyn', screenCount: 3, trafficLevel: 'medium', status: 'active' },
            { id: 'str_004', retailerId: 'ret_001', name: 'Metro Queens', address: '321 Queens Blvd, Queens', city: 'Queens', screenCount: 2, trafficLevel: 'medium', status: 'active' },
            { id: 'str_005', retailerId: 'ret_001', name: 'Metro Bronx', address: '654 Grand Concourse, Bronx', city: 'Bronx', screenCount: 2, trafficLevel: 'low', status: 'active' },
            // FreshMart Express (10 stores)
            { id: 'str_006', retailerId: 'ret_002', name: 'FreshMart SoHo', address: '111 Prince St, NYC', city: 'New York', screenCount: 2, trafficLevel: 'high', status: 'active' },
            { id: 'str_007', retailerId: 'ret_002', name: 'FreshMart Chelsea', address: '222 W 23rd St, NYC', city: 'New York', screenCount: 2, trafficLevel: 'medium', status: 'active' },
            { id: 'str_008', retailerId: 'ret_002', name: 'FreshMart UES', address: '333 E 86th St, NYC', city: 'New York', screenCount: 2, trafficLevel: 'medium', status: 'active' },
            { id: 'str_009', retailerId: 'ret_002', name: 'FreshMart Williamsburg', address: '444 Bedford Ave, Brooklyn', city: 'Brooklyn', screenCount: 2, trafficLevel: 'medium', status: 'active' },
            { id: 'str_010', retailerId: 'ret_002', name: 'FreshMart Astoria', address: '555 Steinway St, Queens', city: 'Queens', screenCount: 1, trafficLevel: 'low', status: 'active' },
            // QuickStop Convenience (8 stores)
            { id: 'str_011', retailerId: 'ret_003', name: 'QuickStop Penn Station', address: '31st St & 7th Ave, NYC', city: 'New York', screenCount: 2, trafficLevel: 'high', status: 'active' },
            { id: 'str_012', retailerId: 'ret_003', name: 'QuickStop Grand Central', address: '42nd St & Park Ave, NYC', city: 'New York', screenCount: 2, trafficLevel: 'high', status: 'active' },
            { id: 'str_013', retailerId: 'ret_003', name: 'QuickStop Times Square', address: '42nd St & Broadway, NYC', city: 'New York', screenCount: 2, trafficLevel: 'high', status: 'active' },
            { id: 'str_014', retailerId: 'ret_003', name: 'QuickStop Financial', address: '55 Wall St, NYC', city: 'New York', screenCount: 1, trafficLevel: 'medium', status: 'active' },
            { id: 'str_015', retailerId: 'ret_003', name: 'QuickStop JFK Terminal', address: 'JFK Airport Terminal 4', city: 'Queens', screenCount: 3, trafficLevel: 'high', status: 'active' }
        ];
        this._set('stores', stores);

        // Seed Screens (based on store screenCount)
        const screens = [];
        const screenTypes = ['entrance', 'checkout', 'aisle', 'endcap'];
        stores.forEach(store => {
            for (let i = 1; i <= store.screenCount; i++) {
                screens.push({
                    id: `scr_${store.id.split('_')[1]}_${String(i).padStart(2, '0')}`,
                    storeId: store.id,
                    retailerId: store.retailerId,
                    name: `${store.name} - Screen ${i}`,
                    type: screenTypes[(i - 1) % screenTypes.length],
                    resolution: '1920x1080',
                    orientation: 'landscape',
                    status: Math.random() > 0.1 ? 'online' : 'offline',
                    lastHeartbeat: new Date(Date.now() - Math.random() * 3600000).toISOString(),
                    installedAt: store.createdAt || '2025-01-01T00:00:00Z'
                });
            }
        });
        this._set('screens', screens);

        // Seed Advertisers
        const advertisers = [
            {
                id: 'adv_001',
                name: 'TechGear Electronics',
                logo: '📱',
                industry: 'Electronics',
                contactEmail: 'marketing@techgear.com',
                budget: 50000,
                status: 'active',
                createdAt: '2025-02-01T00:00:00Z'
            },
            {
                id: 'adv_002',
                name: 'NutriBoost Beverages',
                logo: '🥤',
                industry: 'Food & Beverage',
                contactEmail: 'ads@nutriboost.com',
                budget: 35000,
                status: 'active',
                createdAt: '2025-02-15T00:00:00Z'
            },
            {
                id: 'adv_003',
                name: 'StyleVogue Fashion',
                logo: '👗',
                industry: 'Fashion',
                contactEmail: 'media@stylevogue.com',
                budget: 75000,
                status: 'active',
                createdAt: '2025-03-01T00:00:00Z'
            },
            {
                id: 'adv_004',
                name: 'AutoDrive Motors',
                logo: '🚗',
                industry: 'Automotive',
                contactEmail: 'promo@autodrive.com',
                budget: 100000,
                status: 'active',
                createdAt: '2025-04-01T00:00:00Z'
            },
            {
                id: 'adv_005',
                name: 'HealthPlus Pharmacy',
                logo: '💊',
                industry: 'Healthcare',
                contactEmail: 'outreach@healthplus.com',
                budget: 25000,
                status: 'active',
                createdAt: '2025-05-01T00:00:00Z'
            }
        ];
        this._set('advertisers', advertisers);

        // Seed Users
        const users = [
            { id: 'usr_001', email: 'superadmin@softomedia.com', name: 'Admin User', role: 'super_admin', status: 'active' },
            { id: 'usr_002', email: 'content@softomedia.com', name: 'Content Manager', role: 'content_manager', status: 'active' },
            { id: 'usr_003', email: 'ops@softomedia.com', name: 'Tech Ops', role: 'tech_operator', status: 'active' },
            { id: 'usr_004', email: 'manager@metrosuper.com', name: 'Metro Admin', role: 'retailer_admin', retailerId: 'ret_001', status: 'active' },
            { id: 'usr_005', email: 'admin@freshmart.com', name: 'FreshMart Admin', role: 'retailer_admin', retailerId: 'ret_002', status: 'active' },
            { id: 'usr_006', email: 'media@techgear.com', name: 'TechGear Media', role: 'advertiser', advertiserId: 'adv_001', status: 'active' },
            { id: 'usr_007', email: 'ads@nutriboost.com', name: 'NutriBoost Ads', role: 'advertiser', advertiserId: 'adv_002', status: 'active' }
        ];
        this._set('users', users);

        // Seed Pricing Config
        const pricingConfig = {
            baseCPM: 2.50,
            trafficTiers: DEFAULT_TRAFFIC_TIERS,
            retailerOverrides: {
                'ret_001': { baseCPM: 3.00 }, // Metro premium pricing
                'ret_003': { baseCPM: 3.50 }  // QuickStop high-traffic premium
            },
            storeOverrides: {},
            screenOverrides: {},
            dateOverrides: {} // For special events/holidays
        };
        this._set('pricingConfig', pricingConfig);

        // Seed sample campaigns
        const campaigns = [
            {
                id: 'cmp_001',
                advertiserId: 'adv_001',
                name: 'TechGear Summer Sale',
                status: 'live',
                creativeUrl: 'https://picsum.photos/seed/tech1/1920/1080',
                duration: 5,
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                budget: 5000,
                spent: 1250,
                slots: [],
                createdAt: '2025-12-28T00:00:00Z'
            },
            {
                id: 'cmp_002',
                advertiserId: 'adv_002',
                name: 'NutriBoost Energy Launch',
                status: 'live',
                creativeUrl: 'https://picsum.photos/seed/nutri1/1920/1080',
                duration: 5,
                startDate: '2026-01-05',
                endDate: '2026-02-05',
                budget: 8000,
                spent: 500,
                slots: [],
                createdAt: '2026-01-02T00:00:00Z'
            },
            {
                id: 'cmp_003',
                advertiserId: 'adv_003',
                name: 'StyleVogue Winter Collection',
                status: 'scheduled',
                creativeUrl: 'https://picsum.photos/seed/style1/1920/1080',
                duration: 5,
                startDate: '2026-01-10',
                endDate: '2026-02-10',
                budget: 12000,
                spent: 0,
                slots: [],
                createdAt: '2026-01-04T00:00:00Z'
            }
        ];
        this._set('campaigns', campaigns);

        // Initialize empty validation queue
        this._set('validationQueue', []);

        // Initialize empty audit log
        this._set('auditLog', []);

        // Generate loops for next 7 days
        this._generateLoops(7);
    }

    _generateLoops(days) {
        const loops = [];
        const screens = this._get('screens') || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = 0; d < days; d++) {
            const loopDate = new Date(today);
            loopDate.setDate(loopDate.getDate() + d);
            const dateStr = loopDate.toISOString().split('T')[0];

            // Generate loops for each screen
            screens.forEach(screen => {
                // Generate for each business hour
                for (let hour = BUSINESS_HOURS.START; hour < BUSINESS_HOURS.END; hour++) {
                    const loopId = `loop_${screen.id}_${dateStr}_${hour}`;

                    // Create 12 slots for this loop
                    const slots = [];
                    for (let slotIndex = 0; slotIndex < 12; slotIndex++) {
                        slots.push({
                            index: slotIndex,
                            status: 'available', // available, booked, retailer
                            campaignId: null,
                            advertiserId: null,
                            creativeUrl: null
                        });
                    }

                    // Randomly book some slots for demo purposes (only for past/today)
                    if (d <= 1) {
                        const campaigns = this._get('campaigns') || [];
                        const liveCampaigns = campaigns.filter(c => c.status === 'live');
                        const bookCount = Math.floor(Math.random() * 6); // 0-5 slots booked

                        for (let b = 0; b < bookCount && liveCampaigns.length > 0; b++) {
                            const randomSlot = Math.floor(Math.random() * 12);
                            if (slots[randomSlot].status === 'available') {
                                const campaign = liveCampaigns[Math.floor(Math.random() * liveCampaigns.length)];
                                slots[randomSlot] = {
                                    index: randomSlot,
                                    status: 'booked',
                                    campaignId: campaign.id,
                                    advertiserId: campaign.advertiserId,
                                    creativeUrl: campaign.creativeUrl
                                };
                            }
                        }
                    }

                    loops.push({
                        id: loopId,
                        screenId: screen.id,
                        storeId: screen.storeId,
                        retailerId: screen.retailerId,
                        date: dateStr,
                        hour: hour,
                        slots: slots,
                        totalSlots: 12,
                        bookedSlots: slots.filter(s => s.status !== 'available').length,
                        validationStatus: d === 0 ? 'approved' : 'pending', // Today approved, tomorrow pending
                        validatedAt: d === 0 ? new Date().toISOString() : null,
                        validatedBy: d === 0 ? 'usr_004' : null
                    });
                }
            });
        }

        this._set('loops', loops);
    }

    // ============================================
    // RETAILERS CRUD
    // ============================================

    getRetailers() {
        this.init();
        return this._get('retailers') || [];
    }

    getRetailer(id) {
        return this.getRetailers().find(r => r.id === id);
    }

    createRetailer(data) {
        const retailers = this.getRetailers();
        const newRetailer = {
            id: this._generateId('ret'),
            ...data,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        retailers.push(newRetailer);
        this._set('retailers', retailers);
        this._logAction('retailer_created', newRetailer.id, data);
        return newRetailer;
    }

    updateRetailer(id, data) {
        const retailers = this.getRetailers();
        const index = retailers.findIndex(r => r.id === id);
        if (index !== -1) {
            retailers[index] = { ...retailers[index], ...data };
            this._set('retailers', retailers);
            this._logAction('retailer_updated', id, data);
            return retailers[index];
        }
        return null;
    }

    // ============================================
    // STORES CRUD
    // ============================================

    getStores(retailerId = null) {
        this.init();
        const stores = this._get('stores') || [];
        return retailerId ? stores.filter(s => s.retailerId === retailerId) : stores;
    }

    getStore(id) {
        return this.getStores().find(s => s.id === id);
    }

    // ============================================
    // SCREENS CRUD
    // ============================================

    getScreens(filters = {}) {
        this.init();
        let screens = this._get('screens') || [];

        if (filters.retailerId) {
            screens = screens.filter(s => s.retailerId === filters.retailerId);
        }
        if (filters.storeId) {
            screens = screens.filter(s => s.storeId === filters.storeId);
        }
        if (filters.status) {
            screens = screens.filter(s => s.status === filters.status);
        }

        return screens;
    }

    getScreen(id) {
        return this.getScreens().find(s => s.id === id);
    }

    updateScreenStatus(id, status) {
        const screens = this._get('screens') || [];
        const index = screens.findIndex(s => s.id === id);
        if (index !== -1) {
            screens[index].status = status;
            screens[index].lastHeartbeat = new Date().toISOString();
            this._set('screens', screens);
            return screens[index];
        }
        return null;
    }

    // ============================================
    // ADVERTISERS CRUD
    // ============================================

    getAdvertisers() {
        this.init();
        return this._get('advertisers') || [];
    }

    getAdvertiser(id) {
        return this.getAdvertisers().find(a => a.id === id);
    }

    createAdvertiser(data) {
        const advertisers = this.getAdvertisers();
        const newAdvertiser = {
            id: this._generateId('adv'),
            ...data,
            budget: data.budget || 0,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        advertisers.push(newAdvertiser);
        this._set('advertisers', advertisers);
        this._logAction('advertiser_created', newAdvertiser.id, data);
        return newAdvertiser;
    }

    updateAdvertiser(id, data) {
        const advertisers = this.getAdvertisers();
        const index = advertisers.findIndex(a => a.id === id);
        if (index !== -1) {
            advertisers[index] = { ...advertisers[index], ...data };
            this._set('advertisers', advertisers);
            this._logAction('advertiser_updated', id, data);
            return advertisers[index];
        }
        return null;
    }

    // ============================================
    // USERS CRUD
    // ============================================

    getUsers() {
        this.init();
        return this._get('users') || [];
    }

    getUser(id) {
        return this.getUsers().find(u => u.id === id);
    }

    getUsersByRole(role) {
        return this.getUsers().filter(u => u.role === role);
    }

    createUser(data) {
        const users = this.getUsers();
        const newUser = {
            id: this._generateId('usr'),
            ...data,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        this._set('users', users);
        this._logAction('user_created', newUser.id, { email: data.email, role: data.role });
        return newUser;
    }

    // ============================================
    // CAMPAIGNS CRUD
    // ============================================

    getCampaigns(advertiserId = null) {
        this.init();
        const campaigns = this._get('campaigns') || [];
        return advertiserId ? campaigns.filter(c => c.advertiserId === advertiserId) : campaigns;
    }

    getCampaign(id) {
        return this.getCampaigns().find(c => c.id === id);
    }

    createCampaign(data) {
        const campaigns = this.getCampaigns();
        const newCampaign = {
            id: this._generateId('cmp'),
            ...data,
            status: 'pending_approval',
            spent: 0,
            createdAt: new Date().toISOString()
        };
        campaigns.push(newCampaign);
        this._set('campaigns', campaigns);
        this._logAction('campaign_created', newCampaign.id, data);
        return newCampaign;
    }

    updateCampaign(id, data) {
        const campaigns = this.getCampaigns();
        const index = campaigns.findIndex(c => c.id === id);
        if (index !== -1) {
            campaigns[index] = { ...campaigns[index], ...data };
            this._set('campaigns', campaigns);
            return campaigns[index];
        }
        return null;
    }

    // ============================================
    // LOOPS & SLOTS
    // ============================================

    getLoops(filters = {}) {
        this.init();
        let loops = this._get('loops') || [];

        if (filters.date) {
            loops = loops.filter(l => l.date === filters.date);
        }
        if (filters.screenId) {
            loops = loops.filter(l => l.screenId === filters.screenId);
        }
        if (filters.storeId) {
            loops = loops.filter(l => l.storeId === filters.storeId);
        }
        if (filters.retailerId) {
            loops = loops.filter(l => l.retailerId === filters.retailerId);
        }
        if (filters.hour !== undefined) {
            loops = loops.filter(l => l.hour === filters.hour);
        }
        if (filters.validationStatus) {
            loops = loops.filter(l => l.validationStatus === filters.validationStatus);
        }

        return loops;
    }

    getLoop(id) {
        return this.getLoops().find(l => l.id === id);
    }

    getLoopByParams(screenId, date, hour) {
        return this.getLoops().find(l =>
            l.screenId === screenId && l.date === date && l.hour === hour
        );
    }

    bookSlot(loopId, slotIndex, campaignId, advertiserId, creativeUrl) {
        const loops = this._get('loops') || [];
        const loopIndex = loops.findIndex(l => l.id === loopId);

        if (loopIndex === -1) return { success: false, error: 'Loop not found' };

        const loop = loops[loopIndex];
        if (loop.slots[slotIndex].status !== 'available') {
            return { success: false, error: 'Slot already booked' };
        }

        loop.slots[slotIndex] = {
            index: slotIndex,
            status: 'booked',
            campaignId,
            advertiserId,
            creativeUrl,
            bookedAt: new Date().toISOString()
        };
        loop.bookedSlots = loop.slots.filter(s => s.status !== 'available').length;

        // Mark for validation
        if (loop.validationStatus === 'approved') {
            loop.validationStatus = 'pending';
        }

        loops[loopIndex] = loop;
        this._set('loops', loops);
        this._logAction('slot_booked', loopId, { slotIndex, campaignId });

        return { success: true, loop };
    }

    // ============================================
    // PRICING CONFIG
    // ============================================

    getPricingConfig() {
        this.init();
        return this._get('pricingConfig') || {
            baseCPM: 2.50,
            trafficTiers: DEFAULT_TRAFFIC_TIERS,
            retailerOverrides: {},
            storeOverrides: {},
            screenOverrides: {},
            dateOverrides: {}
        };
    }

    updatePricingConfig(updates) {
        const config = this.getPricingConfig();
        const newConfig = { ...config, ...updates };
        this._set('pricingConfig', newConfig);
        this._logAction('pricing_updated', null, updates);
        return newConfig;
    }

    setDateOverride(date, overrides) {
        const config = this.getPricingConfig();
        config.dateOverrides[date] = overrides;
        this._set('pricingConfig', config);
        this._logAction('pricing_date_override', null, { date, overrides });
        return config;
    }

    // ============================================
    // VALIDATION QUEUE
    // ============================================

    getValidationQueue(retailerId = null) {
        this.init();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        let loops = this.getLoops({ date: tomorrowStr, validationStatus: 'pending' });

        if (retailerId) {
            loops = loops.filter(l => l.retailerId === retailerId);
        }

        return loops;
    }

    approveLoop(loopId, userId) {
        const loops = this._get('loops') || [];
        const index = loops.findIndex(l => l.id === loopId);

        if (index !== -1) {
            loops[index].validationStatus = 'approved';
            loops[index].validatedAt = new Date().toISOString();
            loops[index].validatedBy = userId;
            this._set('loops', loops);
            this._logAction('loop_approved', loopId, { userId });
            return loops[index];
        }
        return null;
    }

    rejectSlot(loopId, slotIndex, reason, userId) {
        const loops = this._get('loops') || [];
        const index = loops.findIndex(l => l.id === loopId);

        if (index !== -1) {
            loops[index].slots[slotIndex].status = 'rejected';
            loops[index].slots[slotIndex].rejectedReason = reason;
            loops[index].slots[slotIndex].rejectedAt = new Date().toISOString();
            loops[index].slots[slotIndex].rejectedBy = userId;
            this._set('loops', loops);
            this._logAction('slot_rejected', loopId, { slotIndex, reason, userId });
            return loops[index];
        }
        return null;
    }

    // ============================================
    // AUDIT LOG
    // ============================================

    _logAction(action, entityId, details) {
        const log = this._get('auditLog') || [];
        log.unshift({
            id: this._generateId('log'),
            action,
            entityId,
            details,
            timestamp: new Date().toISOString()
        });
        // Keep only last 1000 entries
        this._set('auditLog', log.slice(0, 1000));
    }

    getAuditLog(limit = 100) {
        this.init();
        const log = this._get('auditLog') || [];
        return log.slice(0, limit);
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStats() {
        this.init();
        const retailers = this.getRetailers();
        const stores = this.getStores();
        const screens = this.getScreens();
        const advertisers = this.getAdvertisers();
        const campaigns = this.getCampaigns();

        return {
            retailers: retailers.length,
            stores: stores.length,
            screens: {
                total: screens.length,
                online: screens.filter(s => s.status === 'online').length,
                offline: screens.filter(s => s.status === 'offline').length
            },
            advertisers: advertisers.length,
            campaigns: {
                total: campaigns.length,
                live: campaigns.filter(c => c.status === 'live').length,
                scheduled: campaigns.filter(c => c.status === 'scheduled').length,
                pending: campaigns.filter(c => c.status === 'pending_approval').length
            }
        };
    }
}

// Singleton instance
const localStorageService = new LocalStorageService();

export default localStorageService;
export { BUSINESS_HOURS, DEFAULT_TRAFFIC_TIERS };
