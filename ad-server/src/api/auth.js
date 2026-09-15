import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ACTIONS, requirePermission } from '../middleware/authorization.js';

const router = express.Router();

// Sign-in happens in Firebase Authentication; the server only resolves the profile.

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
