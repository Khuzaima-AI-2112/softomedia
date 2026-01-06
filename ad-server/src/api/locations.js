import express from 'express';
import { locationRepository } from '../repositories/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const locations = await locationRepository.findAll();
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const id = await locationRepository.create(req.body);
        const added = await locationRepository.findById(id);
        res.status(201).json(added);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await locationRepository.delete(req.params.id);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
