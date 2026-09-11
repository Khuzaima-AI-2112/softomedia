import express from 'express';
import { authService } from '../services/index.js';
import logger from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { ACTIONS, requirePermission } from '../middleware/authorization.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Standardized login for MVP personas
 */
router.post('/login', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const result = await authService.login(email);
        res.json(result);
    } catch (error) {
        logger.error('Login error', { error: error.message });
        const status = error.message === 'User not found' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user session
 */
router.get(
    '/me',
    authenticate,
    requirePermission(ACTIONS.AUTHENTICATED_PROFILE_READ),
    (req, res) => res.json({ status: 'ok', user: req.user })
);

export default router;
