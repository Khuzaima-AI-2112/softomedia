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
     * Create a new user
     * Generates an auto-ID and delegates to BaseRepository.create()
     * @param {object} data - User data (name, email, role, linkedentityid, status)
     * @returns {Promise<object>} Created user document with id
     */
    async create(data) {
        // Generate a Firestore-compatible auto-ID
        const id = this.collection ? this.collection.doc().id : `usr_${Date.now()}`;
        return super.create(id, data);
    }

    /**
     * Delete a user by ID
     * @param {string} id - User document ID
     * @returns {Promise<boolean>} True on success; throws if doc does not exist
     */
    async delete(id) {
        const doc = this.db.collection('users').doc(id);
        const snapshot = await doc.get();
        if (!snapshot.exists) {
            throw new Error(`User document ${id} not found`);
        }
        await doc.delete();
        return true;
    }
}

export const userRepository = new UserRepository();
