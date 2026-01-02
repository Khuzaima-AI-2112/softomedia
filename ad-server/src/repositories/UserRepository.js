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
}

export const userRepository = new UserRepository();
