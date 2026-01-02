// Base Repository Class
// Provides common CRUD operations with in-memory fallback for offline testing

import { getFirestore } from '../utils/firestore.js';
import logger from '../utils/logger.js';

// In-memory store for fallback
const MOCK_STORAGE = {};

export class BaseRepository {
    constructor(collectionName) {
        this.collectionName = collectionName;
        this.db = getFirestore();
        if (!MOCK_STORAGE[collectionName]) {
            MOCK_STORAGE[collectionName] = new Map();
        }
    }

    get collection() {
        return this.db ? this.db.collection(this.collectionName) : null;
    }

    async create(id, data) {
        const docData = {
            ...data,
            id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            if (this.collection) {
                await this.collection.doc(id).set(docData);
            }
        } catch (e) {
            logger.error(`Create failed for ${this.collectionName}`, { error: e.message, id });
            // Fallback to memory
        }

        MOCK_STORAGE[this.collectionName].set(id, docData);
        return docData;
    }

    async findById(id) {
        try {
            if (this.collection) {
                const doc = await this.collection.doc(id).get();
                if (doc.exists) return { id: doc.id, ...doc.data() };
            }
        } catch (e) {
            // Fallback
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
                const snapshot = await query.get();
                results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (results.length > 0) return results;
            }
        } catch (e) {
            // Fallback
        }

        // Memory Fallback
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
                await this.collection.doc(id).update(updateData);
            }
        } catch (e) {
            // Fallback
        }

        MOCK_STORAGE[this.collectionName].set(id, updateData);
        return updateData;
    }

    async delete(id) {
        try {
            if (this.collection) await this.collection.doc(id).delete();
        } catch (e) {
            logger.error(`Delete failed for ${this.collectionName}`, { error: e.message, id });
        }
        MOCK_STORAGE[this.collectionName].delete(id);
        return true;
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
                const snapshot = await query.count().get();
                return snapshot.data().count;
            }
        } catch (e) {
            logger.error(`Count failed for ${this.collectionName}`, { error: e.message, options });
        }

        // Memory Fallback
        const all = await this.findAll(options);
        return all.length;
    }
}
