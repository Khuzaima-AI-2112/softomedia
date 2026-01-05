// StoreRepository - Physical store locations
// Extends BaseRepository for Firestore persistence

import { BaseRepository } from './BaseRepository.js';

class StoreRepositoryClass extends BaseRepository {
    constructor() {
        super('stores');
    }

    /**
     * Get all stores, optionally filtered by retailer
     */
    async getByRetailer(retailerId) {
        return this.findAll({
            where: [['retailer_id', '==', retailerId]]
        });
    }

    /**
     * Get stores with screen counts
     */
    async getAllWithScreenCounts() {
        const stores = await this.findAll();
        // Screen counts would be computed from screens collection
        return stores;
    }

    /**
     * Create a new store with screens
     */
    async createWithScreens(storeData, screenCount = 0) {
        const id = `store_${Date.now()}`;
        const store = await this.create(id, {
            ...storeData,
            screen_count: screenCount,
            status: 'active'
        });
        return store;
    }
}

export const StoreRepository = new StoreRepositoryClass();
export default StoreRepository;
