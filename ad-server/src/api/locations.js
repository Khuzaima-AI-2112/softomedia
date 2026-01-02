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

export default router;
