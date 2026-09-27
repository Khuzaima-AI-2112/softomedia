import express from 'express';
import {
    locationRepository,
    retailerRepository,
    screenRepository,
    StoreRepository,
} from '../repositories/index.js';
import PricingRepository from '../repositories/PricingRepository.js';
import { authenticate } from '../middleware/auth.js';
import { normalizeRole } from '../constants/roles.js';
import { slotAvailability } from '../services/SlotReservations.js';

const router = express.Router();

router.use(authenticate);

// Bookable Inventory is the Brand's view of the network.
router.use((req, res, next) => {
    if (normalizeRole(req.user?.role) !== 'brand') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
});

const isCalendarDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

router.get('/', async (req, res) => {
    try {
        return res.json({ items: await bookableInventory() });
    } catch (error) {
        console.error('Failed to load Bookable Inventory:', error);
        return res.status(500).json({ error: 'Bookable Inventory could not be loaded' });
    }
});

/**
 * GET /api/inventory/stores/:storeId/slots?date=YYYY-MM-DD
 * Each Slot of each operating hour with only its category and status (free,
 * taken or yours), so a Brand never learns which organization holds a Slot,
 * plus each hour's price and the date's Booking Cutoff.
 */
router.get('/stores/:storeId/slots', async (req, res) => {
    const { date } = req.query;
    if (!isCalendarDate(date)) {
        return res.status(400).json({ error: 'date must be a calendar date in YYYY-MM-DD form' });
    }

    try {
        const items = await bookableInventory();
        if (!items.some(item => item.store.id === req.params.storeId)) {
            return res.status(404).json({ error: 'Store not found' });
        }
        const store = await StoreRepository.findById(req.params.storeId);
        const brandId = req.user.linked_entity_id || req.user.organization_id || null;
        return res.json(await slotAvailability(store, date, brandId));
    } catch (error) {
        console.error('Failed to load Slot availability:', error);
        return res.status(500).json({ error: 'Slot availability could not be loaded' });
    }
});

async function bookableInventory() {
    const [retailers, stores, locations, screens, pricing] = await Promise.all([
        retailerRepository.findAll(),
        StoreRepository.findAll(),
        locationRepository.findAll(),
        screenRepository.findAll(),
        PricingRepository.getConfig(),
    ]);

    const activeRetailers = new Map(retailers
        .filter(retailer => retailer.status === 'active' && !retailer.deleted_at)
        .map(retailer => [retailer.id, retailer]));
    const activeStores = new Map(stores
        .filter(store => store.status !== 'inactive' && !store.deleted_at
            && activeRetailers.has(store.retailer_id))
        .map(store => [store.id, store]));
    const activeLocations = new Map(locations
        .filter(location => location.status !== 'inactive' && !location.deleted_at)
        .map(location => [location.id, location]));

    return screens.flatMap(screen => {
        const store = activeStores.get(screen.store_id);
        const location = activeLocations.get(screen.location_id);
        const retailer = store && activeRetailers.get(store.retailer_id);
        const belongsToRetailer = location?.retailer_id === retailer?.id
            && screen.retailer_id === retailer?.id;
        const isBookable = screen.bookable !== false
            && screen.status !== 'inactive'
            && !screen.deleted_at;
        if (!store || !location || !retailer || location.store_id !== store.id
            || !belongsToRetailer || !isBookable) return [];

        const baseCPM = pricing.retailerOverrides?.[retailer.id]?.baseCPM
            || pricing.baseCPM;
        // The Store's assigned foot-traffic tier prices on top of the
        // hour-of-day tier and the retailer base CPM override. It is the
        // explicitly assigned `cpm_traffic_tier`, never the Store's
        // descriptive `traffic_level`, so no Store reprices until an
        // administrator assigns it a tier.
        const storeTrafficMultiplier = PricingRepository
            .storeTrafficMultiplier(pricing, store.cpm_traffic_tier);
        const trafficTiers = Object.entries(pricing.trafficTiers || {}).map(([id, tier]) => ({
            id,
            label: tier.label,
            multiplier: tier.multiplier,
            hours: tier.hours,
            price: Math.round(baseCPM * tier.multiplier * storeTrafficMultiplier * 100) / 100,
        }));

        return [{
            retailer: { id: retailer.id, name: retailer.name, logo: retailer.logo || null },
            store: {
                id: store.id,
                name: store.name,
                address: store.address || '',
                city: store.city || '',
                country: store.country || '',
                time_zone: store.time_zone,
                cpm_traffic_tier: store.cpm_traffic_tier || null,
            },
            location: { id: location.id, name: location.name },
            screen: {
                id: screen.id,
                name: screen.name,
                resolution: screen.resolution,
                orientation: screen.orientation,
            },
            availability: {
                status: 'available',
                bookable: true,
            },
            booking_price: {
                currency: pricing.currency,
                unit: 'CPM',
                // `base` is the unmultiplied CPM; each traffic_tiers[].price
                // is already fully resolved, store tier included.
                base: baseCPM,
                store_traffic_multiplier: storeTrafficMultiplier,
                traffic_tiers: trafficTiers,
                date_overrides: Object.fromEntries(Object.entries(pricing.dateOverrides || {})
                    .map(([date, override]) => [date, {
                        multiplier: override.multiplier || 1,
                        hourly_tiers: override.hourlyTiers || {},
                    }])),
            },
        }];
    }).sort((left, right) => (
        left.retailer.name.localeCompare(right.retailer.name)
        || left.store.name.localeCompare(right.store.name)
        || left.location.name.localeCompare(right.location.name)
    ));
}

export default router;
