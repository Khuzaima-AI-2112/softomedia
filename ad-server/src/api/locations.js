import express from 'express';
import { locationRepository } from '../repositories/index.js';
import StoreRepository from '../repositories/StoreRepository.js';
import { loopRepository } from '../repositories/LoopRepository.js';
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
        return res.json(await loopRepository.findAll({ where }));
    } catch (error) {
        logger.error('[Locations API] GET /:id/loops failed', { locationId: req.params.id, error: error.message });
        return res.status(500).json({ error: 'Failed to fetch loops for location' });
    }
});

export default router;
