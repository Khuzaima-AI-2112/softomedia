import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { permissionsFor } from '../middleware/requireRole.js';

const router = express.Router();

// Sign-in happens in Firebase Authentication; the server only resolves the profile.

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile and the explicit grants it holds.
 */
router.get(
    '/me',
    authenticate,
    (req, res) => res.json({ status: 'ok', user: { ...req.user, permissions: permissionsFor(req.user) } })
);

export default router;
