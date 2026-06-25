import express from 'express';
import { locationRepository } from '../repositories/index.js';
import { loopRepository, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { requireRole } from '../middleware/requireRole.js';
import logger from '../utils/logger.js';

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
        const id = req.body.id || `loc_${Date.now()}`;
        await locationRepository.create(id, req.body);
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

// --- Nested Loop Routes for Locations ---

router.get('/:id/loops', requireRole('retaileradmin'), async (req, res) => {
    try {
        const locationId = req.params.id;
        const { date, status } = req.query;

        const where = [['location_id', '==', locationId]];
        if (date)   where.push(['date',   '==', date]);
        if (status) where.push(['status', '==', status]);

        const loops = await loopRepository.findAll({ where });

        logger.info('[Locations API] GET /:id/loops', { locationId, date, status, count: loops.length });
        res.json(loops);
    } catch (error) {
        logger.error('[Locations API] GET /:id/loops failed', { locationId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to fetch loops for location' });
    }
});

router.post('/:id/loops/approve-all', requireRole('retaileradmin'), async (req, res) => {
    try {
        const locationId = req.params.id;
        const { date } = req.body;

        const where = [
            ['location_id', '==', locationId],
            ['status', '==', LOOP_STATUS.PENDING_APPROVAL],
        ];
        if (date) where.push(['date', '==', date]);

        const pendingLoops = await loopRepository.findAll({ where });

        if (pendingLoops.length === 0) {
            return res.json({ approved: 0, message: 'No pending loops found for this location' });
        }

        const userId = req.user?.uid || null;
        const approvalPromises = pendingLoops.map(loop =>
            loopRepository.update(loop.id, {
                status: LOOP_STATUS.APPROVED,
                approved_at: new Date().toISOString(),
                approved_by: userId,
            })
        );
        await Promise.all(approvalPromises);

        logger.info('[Locations API] Bulk approve-all', { locationId, date, count: pendingLoops.length, userId });
        res.json({ approved: pendingLoops.length });
    } catch (error) {
        logger.error('[Locations API] POST /:id/loops/approve-all failed', { locationId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to bulk approve loops' });
    }
});
