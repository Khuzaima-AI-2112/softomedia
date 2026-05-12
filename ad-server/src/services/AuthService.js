import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

export class AuthService {
    /**
     * Authenticate user by email
     * @param {string} email 
     * @returns {Promise<object>} { user, token }
     */
    async login(email) {
        try {
            const user = await userRepository.findByEmail(email);
            if (!user) {
                throw new Error('User not found');
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, linked_entity_id: user.linked_entity_id },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.info('User logged in successfully', { email: user.email, role: user.role });
            return { user, token };
        } catch (error) {
            logger.error('Login failed', { email, error: error.message });
            throw error;
        }
    }

    /**
     * Verify JWT token
     * @param {string} token 
     * @returns {object} decoded token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}

export const authService = new AuthService();
