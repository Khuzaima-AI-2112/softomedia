import express from 'express';
import { adRepository, mediaRepository } from '../repositories/index.js';

const router = express.Router();

/**
 * GET /api/assets
 * List media assets available for campaigns
 */
router.get('/', async (req, res) => {
    try {
        const assets = await mediaRepository.findAll();
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/assets/upload
 * Register a new creative asset
 */
router.post('/upload', async (req, res) => {
    try {
        const { filename, duration, file_type } = req.body;
        const id = `ast_${Date.now()}`;
        const asset = await mediaRepository.create(id, {
            id,
            filename,
            duration: duration || 5,
            file_type,
            storage_path: `mock/${filename}`,
            status: 'ready',
            created_at: new Date().toISOString()
        });
        res.status(201).json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
