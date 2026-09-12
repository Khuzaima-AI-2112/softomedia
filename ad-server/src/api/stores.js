import express from 'express';
import StoreRepository from '../repositories/StoreRepository.js';
import { BusinessHoursService } from '../services/BusinessHoursService.js';
import { authenticate } from '../middleware/auth.js';
import {
    canManageAnyRetailer,
    canManageRetailer,
    denyStoreAccess,
    findManagedStore,
    retailerIdFor,
} from '../middleware/storeManagement.js';

const router = express.Router();
const DEFAULT_WEEKLY_HOURS = Object.freeze(
    Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        open_time: '08:00',
        close_time: '22:00',
        is_closed: false,
    })),
);

router.use(authenticate);

function isValidTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
    try {
        Intl.DateTimeFormat('en-US', { timeZone }).format();
        return true;
    } catch {
        return false;
    }
}

router.get('/', async (req, res) => {
    try {
        const requestedRetailerId = req.query.retailer_id || req.query.retailerId || req.query.retailerid;
        const ownRetailerId = retailerIdFor(req.user);

        if (!canManageAnyRetailer(req.user)) {
            if (!ownRetailerId || (requestedRetailerId && requestedRetailerId !== ownRetailerId)) {
                return denyStoreAccess(res);
            }
            return res.json(await StoreRepository.getByRetailer(ownRetailerId));
        }

        const stores = requestedRetailerId
            ? await StoreRepository.getByRetailer(requestedRetailerId)
            : await StoreRepository.findAll();
        return res.json(stores);
    } catch (error) {
        console.error('Failed to fetch stores:', error);
        return res.status(500).json({ error: 'Failed to fetch stores' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        return res.json(store);
    } catch (error) {
        console.error('Failed to fetch store:', error);
        return res.status(500).json({ error: 'Failed to fetch store' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, retailer_id, store_profile, address, city, state, screen_count, time_zone } = req.body;
        if (!name || !retailer_id || !time_zone) {
            return res.status(400).json({ error: 'Name, retailer_id, and time_zone are required' });
        }
        if (!isValidTimeZone(time_zone)) {
            return res.status(400).json({ error: 'time_zone must be a valid IANA time zone' });
        }
        if (!canManageRetailer(req.user, retailer_id)) return denyStoreAccess(res);

        const store = await StoreRepository.createWithScreens({
            name,
            retailer_id,
            time_zone,
            store_profile: store_profile || 'standard',
            address: address || '',
            city: city || '',
            state: state || '',
            location: { lat: 0, lng: 0 },
        }, screen_count || 0);

        await BusinessHoursService.updateWeeklyHours(store.id, DEFAULT_WEEKLY_HOURS);
        return res.status(201).json(store);
    } catch (error) {
        console.error('Failed to create store:', error);
        return res.status(500).json({ error: 'Failed to create store' });
    }
});

async function updateStore(req, res) {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        if (req.body.retailer_id && req.body.retailer_id !== store.retailer_id) return denyStoreAccess(res);
        if (req.body.time_zone && !isValidTimeZone(req.body.time_zone)) {
            return res.status(400).json({ error: 'time_zone must be a valid IANA time zone' });
        }
        return res.json(await StoreRepository.update(store.id, req.body));
    } catch (error) {
        console.error('Failed to update store:', error);
        return res.status(500).json({ error: 'Failed to update store' });
    }
}

router.put('/:id', updateStore);
router.patch('/:id', updateStore);

router.delete('/:id', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        await StoreRepository.delete(store.id);
        return res.status(204).send();
    } catch (error) {
        console.error('Failed to delete store:', error);
        return res.status(500).json({ error: 'Failed to delete store' });
    }
});

router.get('/:id/hours', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        if (!req.query.date) return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD)' });
        return res.json(await BusinessHoursService.getEffectiveHours(store.id, req.query.date));
    } catch (error) {
        console.error('Failed to fetch effective hours:', error);
        return res.status(500).json({ error: 'Failed to fetch effective hours' });
    }
});

router.get('/:id/weekly-hours', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        return res.json(await BusinessHoursService.getWeeklyHours(store.id));
    } catch (error) {
        console.error('Failed to fetch weekly hours:', error);
        return res.status(500).json({ error: 'Failed to fetch weekly hours' });
    }
});

router.put('/:id/weekly-hours', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        return res.json(await BusinessHoursService.updateWeeklyHours(store.id, req.body.weekly_hours));
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/:id/special-hours', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        const { date, ...hoursData } = req.body;
        if (!date) return res.status(400).json({ error: 'Date is required' });
        return res.json(await BusinessHoursService.updateSpecialHours(store.id, date, hoursData));
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/:id/special-hours', async (req, res) => {
    try {
        const store = await findManagedStore(req, res, req.params.id);
        if (!store) return;
        return res.json(await BusinessHoursService.listSpecialHours(store.id));
    } catch (error) {
        console.error('Failed to fetch special hours list:', error);
        return res.status(500).json({ error: 'Failed to fetch special hours list' });
    }
});

export default router;
