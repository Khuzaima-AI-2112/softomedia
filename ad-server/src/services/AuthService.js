import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';
import { toCanonicalRole } from '../constants/roles.js';

// JWT_SECRET is loaded dynamically to avoid ESM hoisting issues

export class AuthService {
    async resolveFirebaseIdentity(decodedToken) {
        const profile = await userRepository.findById(decodedToken.uid)
            || await userRepository.findByEmail(decodedToken.email);
        const role = toCanonicalRole(profile?.role);

        if (!profile || !role) return null;

        if (profile.role !== role) {
            await userRepository.update(profile.id, { role });
        }

        const organizationId = profile.organization_id
            || profile.linked_entity_id
            || profile.linkedentityid
            || null;

        return {
            id: profile.id,
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: profile.name || decodedToken.name || decodedToken.email,
            role,
            linked_entity_id: organizationId,
            organization_id: organizationId,
            permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
        };
    }

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
                process.env.JWT_SECRET,
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
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}

export const authService = new AuthService();
