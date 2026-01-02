import express from 'express';
import { screenRepository } from '../repositories/index.js';

const router = express.Router();

/**
 * POST /api/screens/register
 * Register a new screen in the network
 */
router.post('/register', async (req, res) => {
    try {
        const { screen_id, resolution, user_agent } = req.body;
        if (!screen_id) return res.status(400).json({ error: 'screen_id required' });

        const screen = await screenRepository.create(screen_id, {
            screen_id,
            resolution,
            user_agent,
            status: 'ONLINE',
            last_seen: new Date().toISOString()
        });

        res.json(screen);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/screens
 * List all screens managed by the tenant
 */
router.get('/', async (req, res) => {
    try {
        const screens = await screenRepository.findAll();
        res.json(screens);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
