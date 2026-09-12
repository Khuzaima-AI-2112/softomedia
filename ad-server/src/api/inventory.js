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

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
    if (normalizeRole(req.user?.role) !== 'brand') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
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

        const items = screens.flatMap(screen => {
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
            const trafficTiers = Object.entries(pricing.trafficTiers || {}).map(([id, tier]) => ({
                id,
                label: tier.label,
                multiplier: tier.multiplier,
                hours: tier.hours,
                price: Math.round(baseCPM * tier.multiplier * 100) / 100,
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
                    base: baseCPM,
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

        return res.json({ items });
    } catch (error) {
        console.error('Failed to load Bookable Inventory:', error);
        return res.status(500).json({ error: 'Bookable Inventory could not be loaded' });
    }
});

export default router;
