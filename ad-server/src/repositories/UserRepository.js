// User Repository
// Handles all user-related database operations

import { BaseRepository } from './BaseRepository.js';

export class UserRepository extends BaseRepository {
    constructor() {
        super('users');
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<object|null>} User document or null
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
     * @param {string} role - User role (admin, brand, retailer)
     * @returns {Promise<Array>} Array of users
     */
    async findByRole(role) {
        return this.findAll({
            where: [['role', '==', role]]
        });
    }

    /**
     * Find user by linked entity ID
     * @param {string} entityId - Linked entity ID (brand or screen)
     * @returns {Promise<object|null>} User document or null
     */
    async findByLinkedEntity(entityId) {
        const users = await this.findAll({
            where: [['linked_entity_id', '==', entityId]],
            limit: 1
        });
        return users.length > 0 ? users[0] : null;
    }
}
