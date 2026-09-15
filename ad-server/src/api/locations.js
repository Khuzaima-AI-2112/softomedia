import express from 'express';
import { locationRepository } from '../repositories/index.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { loopRepository, LOOP_STATUS } from '../repositories/LoopRepository.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import { approvalWindowService, ApprovalWindowError } from '../services/ApprovalWindowService.js';
import { PERMISSIONS, userHasPermission } from '../middleware/requireRole.js';
import {
    canManageRetailer,
    denyStoreAccess,
    findManagedStore,
    retailerIdFor,
} from '../middleware/storeManagement.js';
import logger from '../utils/logger.js';

const router = express.Router();

async function includeStoreTimeZones(locations) {
    return Promise.all(locations.map(async location => {
        const store = location.store_id ? await StoreRepository.findById(location.store_id) : null;
        return { ...location, time_zone: store?.time_zone || null };
    }));
}

router.get('/', async (req, res) => {
    try {
        const storeId = req.query.store_id || req.query.storeId;
        if (storeId) {
            const store = await findManagedStore(req, res, storeId);
            if (!store) return;
            return res.json(await includeStoreTimeZones(
                await locationRepository.findAll({ where: [['store_id', '==', store.id]] }),
            ));
        }

        if (userHasPermission(req.user, PERMISSIONS.STORE_VIEW_NETWORK)) {
            return res.json(await includeStoreTimeZones(await locationRepository.findAll()));
        }

        const retailerId = retailerIdFor(req.user);
        if (!retailerId) return denyStoreAccess(res);
        return res.json(await includeStoreTimeZones(
            await locationRepository.findAll({ where: [['retailer_id', '==', retailerId]] }),
        ));
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, store_id } = req.body;
        if (!name || !store_id) return res.status(400).json({ error: 'name and store_id are required' });
        const store = await findManagedStore(req, res, store_id);
        if (!store) return;

        const id = req.body.id || `loc_${Date.now()}`;
        await locationRepository.create(id, {
            ...req.body,
            name,
            store_id: store.id,
            retailer_id: store.retailer_id,
        });
        return res.status(201).json(await locationRepository.findById(id));
    } catch (error) {
        return res.status(500).json({ error: 'Failed to create location' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const location = await locationRepository.findById(req.params.id);
        if (!location || !canManageRetailer(req.user, location.retailer_id)) return denyStoreAccess(res);
        await locationRepository.delete(location.id);
        return res.status(204).end();
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete location' });
    }
});

async function findManagedLocation(req, res) {
    const location = await locationRepository.findById(req.params.id);
    if (!location || !canManageRetailer(req.user, location.retailer_id)) {
        denyStoreAccess(res);
        return null;
    }
    return location;
}

router.get('/:id/loops', async (req, res) => {
    try {
        const location = await findManagedLocation(req, res);
        if (!location) return;
        const where = [['location_id', '==', location.id]];
        if (req.query.date) where.push(['date', '==', req.query.date]);
        if (req.query.status) where.push(['status', '==', req.query.status]);
        return res.json(await loopRepository.findAll({ where }));
    } catch (error) {
        logger.error('[Locations API] GET /:id/loops failed', { locationId: req.params.id, error: error.message });
        return res.status(500).json({ error: 'Failed to fetch loops for location' });
    }
});

router.post('/:id/loops/approve-all', async (req, res) => {
    try {
        const location = await findManagedLocation(req, res);
        if (!location) return;
        if (normalizeRole(req.user.role) !== ROLES.RETAILERADMIN) return denyStoreAccess(res);

        const where = [
            ['location_id', '==', location.id],
            ['status', '==', LOOP_STATUS.PENDING_APPROVAL],
        ];
        if (req.body.date) where.push(['date', '==', req.body.date]);
        const pendingLoops = await loopRepository.findAll({ where });
        if (pendingLoops.length === 0) return res.json({ approved: 0, message: 'No pending loops found for this location' });

        const store = await StoreRepository.findById(location.store_id);
        const dates = [...new Set(pendingLoops.map(loop => loop.date))];
        await Promise.all(dates.map(date => approvalWindowService.assertOpen(
            { id: location.store_id, time_zone: location.time_zone || store?.time_zone },
            date,
        )));
        await Promise.all(pendingLoops.map(loop => loopRepository.approveLoop(
            loop.id,
            req.user?.uid || req.user?.id || null,
        )));
        return res.json({ approved: pendingLoops.length });
    } catch (error) {
        if (error instanceof ApprovalWindowError) {
            return res.status(error.status).json({ error: error.message });
        }
        logger.error('[Locations API] POST /:id/loops/approve-all failed', { locationId: req.params.id, error: error.message });
        return res.status(500).json({ error: 'Failed to bulk approve loops' });
    }
});

export default router;
