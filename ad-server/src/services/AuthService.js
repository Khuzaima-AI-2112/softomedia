// Auth Service
// Business logic for authentication

import { userRepository } from '../repositories/index.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export class AuthService {
    /**
     * Authenticate user by email
     * @param {string} email - User email
     * @returns {Promise<{token: string, user: object}>}
     */
    async login(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('Valid email is required');
        }

        const user = await userRepository.findByEmail(email.toLowerCase().trim());

        if (!user) {
            throw new Error('User not found');
        }

        const token = this.generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                linked_entity_id: user.linked_entity_id
            }
        };
    }

    /**
     * Generate JWT token for user
     * @param {object} user - User object
     * @returns {string} JWT token
     */
    generateToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {object} Decoded token payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}

// Export singleton instance
export const authService = new AuthService();
