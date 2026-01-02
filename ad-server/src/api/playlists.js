import express from 'express';
import { playlistRepository } from '../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/playlists - List all
router.get('/', async (req, res) => {
    try {
        const playlists = await playlistRepository.findAll();
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/playlists/:id - Get details
router.get('/:id', async (req, res) => {
    try {
        const playlist = await playlistRepository.findById(req.params.id);
        if (!playlist) return res.status(404).json({ error: 'Not found' });
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/playlists - Create new
router.post('/', async (req, res) => {
    try {
        const { name, description, status = 'DRAFT', items = [], schedule = {}, assignments = [], is_global = false } = req.body;

        const id = `pli_${uuidv4().split('-')[0]}`;
        const newPlaylist = await playlistRepository.create(id, {
            name,
            description,
            status,
            items,
            schedule,
            assignments,
            is_global
        });

        res.status(201).json(newPlaylist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/playlists/:id - Update
router.put('/:id', async (req, res) => {
    try {
        const updated = await playlistRepository.update(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/playlists/:id
router.delete('/:id', async (req, res) => {
    try {
        await playlistRepository.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
