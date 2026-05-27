import express from 'express';
import { userRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';
import { requireSuperAdmin } from '../middleware/requireRole.js';

const router = express.Router();

// ─────────────────────────────────────────────
// Phase 1: All user-management routes are
// gated behind requireSuperAdmin so that only
// users whose role normalises to 'superadmin'
// can list, create, update or delete accounts.
// ─────────────────────────────────────────────
router.use(requireSuperAdmin);

/**
 * GET /api/users
 * List all users  [superadmin only]
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
 * Create a new user  [superadmin only]
 */
router.post('/', async (req, res) => {
    try {
        const { name, email, role, linkedentityid } = req.body;

        const errors = [];

        if (!name || typeof name !== 'string' || name.trim().length < 1) {
            errors.push('Name is required and must be at least 1 character long');
        }

        if (!email || typeof email !== 'string') {
            errors.push('Email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errors.push('Email must be a valid email address');
            }
        }

        const allowedRoles = ['superadmin', 'contentmanager', 'techoperator', 'retaileradmin', 'advertiser'];
        if (!role || typeof role !== 'string' || !allowedRoles.includes(role)) {
            errors.push(`Role is required and must be one of: ${allowedRoles.join(', ')}`);
        }

        if (role === 'advertiser' || role === 'retaileradmin') {
            if (!linkedentityid || typeof linkedentityid !== 'string') {
                errors.push('Linked entity ID is required when role is advertiser or retaileradmin');
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' | ') });
        }

        const userData = {
            name: name.trim(),
            email: email.trim(),
            role: role.trim(),
            linkedentityid: linkedentityid ? linkedentityid.trim() : null,
            status: 'active'
        };

        const createdUser = await userRepository.create(userData);
        logger.info('User created', { actorRole: req.user?.role, newUserEmail: userData.email, newUserRole: userData.role });
        res.status(201).json(createdUser);
    } catch (error) {
        logger.error('Failed to create user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/users/:id
 * Full update  [superadmin only]
 */
router.put('/:id', async (req, res) => {
    try {
        const existing = await userRepository.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { name, email, role, linkedentityid, status } = req.body;
        const errors = [];

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 1) {
                errors.push('Name must be a non-empty string');
            }
        }

        if (email !== undefined) {
            if (typeof email !== 'string') {
                errors.push('Email must be a string');
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    errors.push('Email must be a valid email address');
                }
            }
        }

        const allowedRoles = ['superadmin', 'contentmanager', 'techoperator', 'retaileradmin', 'advertiser'];
        if (role !== undefined && !allowedRoles.includes(role)) {
            errors.push(`Role must be one of: ${allowedRoles.join(', ')}`);
        }

        const allowedStatuses = ['active', 'inactive'];
        if (status !== undefined && !allowedStatuses.includes(status)) {
            errors.push(`Status must be one of: ${allowedStatuses.join(', ')}`);
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' | ') });
        }

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (email !== undefined) updates.email = email.trim();
        if (role !== undefined) updates.role = role;
        if (linkedentityid !== undefined) updates.linkedentityid = linkedentityid ? linkedentityid.trim() : null;
        if (status !== undefined) updates.status = status;

        const updatedUser = await userRepository.update(req.params.id, updates);
        logger.info('User updated (PUT)', { actorRole: req.user?.role, targetId: req.params.id });
        res.status(200).json(updatedUser);
    } catch (error) {
        logger.error('Failed to update user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * PATCH /api/users/:id
 * Partial update — Phase 3 addition  [superadmin only]
 */
router.patch('/:id', async (req, res) => {
    try {
        const existing = await userRepository.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { name, email, role, linkedentityid, status } = req.body;
        const errors = [];
        const allowedRoles    = ['superadmin', 'contentmanager', 'techoperator', 'retaileradmin', 'advertiser'];
        const allowedStatuses = ['active', 'inactive'];

        if (name     !== undefined && (typeof name !== 'string' || name.trim().length < 1)) errors.push('Name must be a non-empty string');
        if (email    !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) errors.push('Email must be a valid email address');
        }
        if (role     !== undefined && !allowedRoles.includes(role))    errors.push(`Role must be one of: ${allowedRoles.join(', ')}`);
        if (status   !== undefined && !allowedStatuses.includes(status)) errors.push(`Status must be one of: ${allowedStatuses.join(', ')}`);

        if (errors.length > 0) return res.status(400).json({ error: errors.join(' | ') });

        const updates = {};
        if (name           !== undefined) updates.name           = name.trim();
        if (email          !== undefined) updates.email          = email.trim();
        if (role           !== undefined) updates.role           = role;
        if (linkedentityid !== undefined) updates.linkedentityid = linkedentityid ? linkedentityid.trim() : null;
        if (status         !== undefined) updates.status         = status;

        const updatedUser = await userRepository.update(req.params.id, updates);
        logger.info('User updated (PATCH)', { actorRole: req.user?.role, targetId: req.params.id, fields: Object.keys(updates) });
        res.status(200).json(updatedUser);
    } catch (error) {
        logger.error('Failed to patch user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * DELETE /api/users/:id
 * Delete a user  [superadmin only]
 */
router.delete('/:id', async (req, res) => {
    try {
        const user = await userRepository.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await userRepository.delete(req.params.id);
        logger.info('User deleted', { actorRole: req.user?.role, targetId: req.params.id });
        res.status(200).json({ message: 'User deleted' });
    } catch (error) {
        logger.error('Failed to delete user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
