import express from 'express';
import { playlistService } from '../services/index.js';

const router = express.Router();

/**
 * GET /api/playlist/:screenId
 * Returns the current ad rotation for a specific screen
 */
router.get('/:screenId', async (req, res) => {
    try {
        const { screenId } = req.params;
        const result = await playlistService.getPlaylistForScreen(screenId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
