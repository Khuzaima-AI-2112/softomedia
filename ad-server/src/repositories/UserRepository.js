import { BaseRepository } from './BaseRepository.js';

export class UserRepository extends BaseRepository {
    constructor() {
        super('users');
    }

    /**
     * Find user by email
     * @param {string} email
     * @returns {Promise<object|null>}
     */
    async findByEmail(email) {
        const users = await this.findAll({
            where: [['email', '==', email]],
            limit: 1
        });
        return users.length > 0 ? users[0] : null;
    }

    /**
     * Find users by role
     * @param {string} role
     * @returns {Promise<Array>}
     */
    async findByRole(role) {
        return this.findAll({
            where: [['role', '==', role]]
        });
    }

    /**
     * Create a new user.
     * Generates a Firestore-compatible auto-ID and delegates to BaseRepository.create().
     * Timestamps (created_at / updated_at) are auto-populated by BaseRepository.
     * @param {object} data - User data (name, email, role, linkedentityid, status)
     * @returns {Promise<object>} Created user document with id
     */
    async create(data) {
        const id = this.collection
            ? this.collection.doc().id
            : `usr_${Date.now()}`;
        return super.create(id, data);
    }

    /**
     * Delete a user by ID.
     * Throws if the document does not exist.
     * Uses circuit breaker for Firestore resilience; falls back to in-memory store.
     * @param {string} id - User document ID
     * @returns {Promise<boolean>} True on success
     */
    async delete(id) {
        if (!this.collection) {
            // Memory-only fallback
            const existing = await this.findById(id);
            if (!existing) {
                throw new Error(`User document ${id} not found`);
            }
            return super.delete(id);
        }

        const docRef = this.collection.doc(id);

        const snapshot = await this.breaker.execute(() => docRef.get());
        if (!snapshot.exists) {
            throw new Error(`User document ${id} not found`);
        }

        await this.breaker.execute(() => docRef.delete());
        return true;
    }
}

export const userRepository = new UserRepository();
