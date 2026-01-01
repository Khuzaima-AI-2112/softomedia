// Base Repository Class
// Provides common CRUD operations for all Firestore collections

import { getFirestore } from '../utils/firestore.js';

export class BaseRepository {
    constructor(collectionName) {
        this.collectionName = collectionName;
        this.db = getFirestore();
        this.collection = this.db.collection(collectionName);
    }

    /**
     * Create a new document
     * @param {string} id - Document ID
     * @param {object} data - Document data
     * @returns {Promise<object>} Created document with ID
     */
    async create(id, data) {
        const docData = {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await this.collection.doc(id).set(docData);
        return { id, ...docData };
    }

    /**
     * Get document by ID
     * @param {string} id - Document ID
     * @returns {Promise<object|null>} Document data or null if not found
     */
    async findById(id) {
        const doc = await this.collection.doc(id).get();
        if (!doc.exists) {
            return null;
        }
        return { id: doc.id, ...doc.data() };
    }

    /**
     * Get all documents in collection
     * @param {object} options - Query options (limit, orderBy, etc.)
     * @returns {Promise<Array>} Array of documents
     */
    async findAll(options = {}) {
        let query = this.collection;

        if (options.where) {
            options.where.forEach(([field, op, value]) => {
                query = query.where(field, op, value);
            });
        }

        if (options.orderBy) {
            const [field, direction = 'asc'] = options.orderBy;
            query = query.orderBy(field, direction);
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Update document by ID
     * @param {string} id - Document ID
     * @param {object} data - Fields to update
     * @returns {Promise<object>} Updated document
     */
    async update(id, data) {
        const updateData = {
            ...data,
            updated_at: new Date().toISOString()
        };

        await this.collection.doc(id).update(updateData);
        return this.findById(id);
    }

    /**
     * Delete document by ID
     * @param {string} id - Document ID
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id) {
        await this.collection.doc(id).delete();
        return true;
    }

    /**
     * Check if document exists
     * @param {string} id - Document ID
     * @returns {Promise<boolean>} True if exists
     */
    async exists(id) {
        const doc = await this.collection.doc(id).get();
        return doc.exists;
    }

    /**
     * Count documents matching query
     * @param {object} options - Query options
     * @returns {Promise<number>} Document count
     */
    async count(options = {}) {
        const docs = await this.findAll(options);
        return docs.length;
    }
}
