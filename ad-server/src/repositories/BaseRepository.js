// Base Repository Class
// Provides common CRUD operations with in-memory fallback for offline testing

import { getFirestore } from '../utils/firestore.js';
import logger from '../utils/logger.js';
import { CircuitBreaker } from '../utils/ResilienceUtility.js';

// In-memory store for fallback
const MOCK_STORAGE = {};

export const clearMockStorage = () => {
    Object.keys(MOCK_STORAGE).forEach(key => delete MOCK_STORAGE[key]);
};

export class BaseRepository {
    constructor(collectionName) {
        this.collectionName = collectionName;
        this.db = getFirestore();
        this.breaker = new CircuitBreaker(`Firestore:${collectionName}`, {
            failureThreshold: 3,
            resetTimeoutMs: 60000 // 1 minute
        });

        if (!MOCK_STORAGE[collectionName]) {
            MOCK_STORAGE[collectionName] = new Map();
        }
    }

    get collection() {
        return this.db ? this.db.collection(this.collectionName) : null;
    }

    async create(id, data) {
        // Auto-generate ID if not provided
        if (!id) {
            id = this.collection ? this.collection.doc().id : 'gen_' + Date.now().toString(36);
        }

        const docData = {
            ...data,
            id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            if (this.collection) {
                // Use .create() instead of .set() to prevent overwriting existing data
                await this.breaker.execute(() => this.collection.doc(id).create(docData));
            }
        } catch (e) {
            logger.error(`Create failed for ${this.collectionName}`, {
                error: e.message,
                id,
                breaker_state: this.breaker.state
            });
            // Fallback to memory is handled outside the catch or by continuing
        }

        MOCK_STORAGE[this.collectionName].set(id, docData);
        return docData;
    }

    async findById(id) {
        try {
            if (this.collection) {
                const doc = await this.breaker.execute(() => this.collection.doc(id).get());
                if (doc.exists) return { id: doc.id, ...doc.data() };
            }
        } catch (e) {
            // Error occurred, potentially fallback
        }

        if (process.env.DISABLE_MOCK_STORAGE === 'true') {
            return null;
        }

        return MOCK_STORAGE[this.collectionName].get(id) || null;
    }

    async findAll(options = {}) {
        let results = [];

        try {
            if (this.collection) {
                let query = this.collection;
                if (options.where) {
                    options.where.forEach(([field, op, value]) => {
                        query = query.where(field, op, value);
                    });
                }

                // PERFORMANCE FIX: Apply limit to Firestore query
                if (options.limit) {
                    query = query.limit(options.limit);
                }

                const snapshot = await this.breaker.execute(() => query.get());
                results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (results.length > 0) return results;
            }
        } catch (e) {
            // Error occurred, potentially fallback
        }

        // Memory Fallback
        if (process.env.DISABLE_MOCK_STORAGE === 'true') {
            return results;
        }

        results = Array.from(MOCK_STORAGE[this.collectionName].values());
        if (options.where) {
            results = results.filter(item => {
                return options.where.every(([field, op, value]) => {
                    if (op === '==') return item[field] === value;
                    if (op === 'array-contains') return Array.isArray(item[field]) && item[field].includes(value);
                    return true;
                });
            });
        }
        if (options.limit) results = results.slice(0, options.limit);
        return results;
    }

    async update(id, data) {
        const existing = await this.findById(id) || {};
        const updateData = { ...existing, ...data, updated_at: new Date().toISOString() };

        try {
            if (this.collection) {
                await this.breaker.execute(() => this.collection.doc(id).update(updateData));
            }
        } catch (e) {
            // Fallback to memory
        }

        MOCK_STORAGE[this.collectionName].set(id, updateData);
        return updateData;
    }

    async delete(id) {
        try {
            if (this.collection) {
                await this.breaker.execute(() => this.collection.doc(id).delete());
            }
        } catch (e) {
            logger.error(`Delete failed for ${this.collectionName}`, {
                error: e.message,
                id,
                breaker_state: this.breaker.state
            });
        }
        MOCK_STORAGE[this.collectionName].delete(id);
        return true;
    }

    async upsert(id, data) {
        const existing = await this.findById(id) || {};
        const updateData = { ...existing, ...data, updated_at: new Date().toISOString() };

        try {
            if (this.collection) {
                await this.breaker.execute(() => this.collection.doc(id).set(updateData, { merge: true }));
            }
        } catch (e) {
            logger.error(`Upsert failed for ${this.collectionName}`, {
                error: e.message,
                id,
                breaker_state: this.breaker.state
            });
        }

        MOCK_STORAGE[this.collectionName].set(id, updateData);
        return updateData;
    }

    async count(options = {}) {
        try {
            if (this.collection) {
                let query = this.collection;
                if (options.where) {
                    options.where.forEach(([field, op, value]) => {
                        query = query.where(field, op, value);
                    });
                }
                const snapshot = await this.breaker.execute(() => query.count().get());
                return snapshot.data().count;
            }
        } catch (e) {
            logger.error(`Count failed for ${this.collectionName}`, {
                error: e.message,
                options,
                breaker_state: this.breaker.state
            });
        }

        // Memory Fallback
        if (process.env.DISABLE_MOCK_STORAGE === 'true') {
            return 0;
        }

        const all = await this.findAll(options);
        return all.length;
    }
}
