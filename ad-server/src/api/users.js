import express from 'express';
import { userRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (req, res) => {
    try {
        const users = await userRepository.findAll();
        res.json(users);
    } catch (error) {
        logger.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', async (req, res) => {
    try {
        const { name, email, role, linkedentityid } = req.body;

        // Validation
        const errors = [];

        // Name validation
        if (!name || typeof name !== 'string' || name.trim().length < 1) {
            errors.push('Name is required and must be at least 1 character long');
        }

        // Email validation
        if (!email || typeof email !== 'string') {
            errors.push('Email is required');
        } else {
            // Basic email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errors.push('Email must be a valid email address');
            }
        }

        // Role validation
        const allowedRoles = ['superadmin', 'contentmanager', 'techoperator', 'retaileradmin', 'advertiser'];
        if (!role || typeof role !== 'string' || !allowedRoles.includes(role)) {
            errors.push(`Role is required and must be one of: ${allowedRoles.join(', ')}`);
        }

        // Linked entity ID validation (conditional)
        if (role === 'advertiser' || role === 'retaileradmin') {
            if (!linkedentityid || typeof linkedentityid !== 'string') {
                errors.push('Linked entity ID is required when role is advertiser or retaileradmin');
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' | ') });
        }

        // Set default status
        const userData = {
            name: name.trim(),
            email: email.trim(),
            role: role.trim(),
            linkedentityid: linkedentityid ? linkedentityid.trim() : null,
            status: 'active'
        };

        // Call UserRepository.create(data) - implementation in TASK 1.2
        const createdUser = await userRepository.create(userData);

        // Return 201 with the created user document
        res.status(201).json(createdUser);
    } catch (error) {
        logger.error('Failed to create user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * DELETE /api/users/:id
 * Delete a user by ID
 */
router.delete('/:id', async (req, res) => {
    try {
        const user = await userRepository.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await userRepository.delete(req.params.id);
        res.status(200).json({ message: 'User deleted' });
    } catch (error) {
        logger.error('Failed to delete user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
