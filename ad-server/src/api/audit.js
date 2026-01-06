import express from 'express';
import { schedulingAuditRepository } from '../repositories/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { locationId } = req.query;
        let audits;
        if (locationId) {
            audits = await schedulingAuditRepository.findByLocation(locationId);
        } else {
            audits = await schedulingAuditRepository.findAll();
        }
        res.json(audits);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
