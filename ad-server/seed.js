import { getFirestore, closeFirestore } from './src/utils/firestore.js';
import logger from './src/utils/logger.js';
import {
    userRepository,
    // adRepository,
    screenRepository,
    retailerRepository,
    advertiserRepository,
    campaignRepository,
    loopRepository,
    StoreRepository,
    PricingRepository as pricingRepository,
    locationRepository,
    mediaRepository,
    playlistRepository
} from './src/repositories/index.js';
import { PERSONAS } from './src/utils/constants.js';

// Phase 1: All SUPER_ADMIN references normalised to the canonical
// 'superadmin' string.  PERSONAS.ADMIN must also resolve to 'superadmin'
// (or 'admin') — the value from constants.js is kept as-is but only
// the string literals below are our concern.
const ROLES = {
    SUPER_ADMIN:          'superadmin',          // ← normalised
    RETAILER_ADMIN:       PERSONAS.RETAILER,
    ADVERTISER:           PERSONAS.BRAND,
    SOFTOMEDIA_MANAGER:   'manager',
    TECH_OPERATOR:        PERSONAS.TECH
};

const seedData = {
    retailers: [
        { id: 'ret_001', name: 'Metro Supermarkets', logo: '🛒', contact_email: 'admin@metrosuper.com', status: 'active' },
        { id: 'ret_002', name: 'FreshMart Express', logo: '🥬', contact_email: 'ops@freshmart.com', status: 'active' },
        { id: 'ret_003', name: 'QuickStop Convenience', logo: '⚡', contact_email: 'manager@quickstop.com', status: 'active' }
    ],
    locations: [
        { id: 'loc_downtown', name: 'Downtown District', type: 'region' },
        { id: 'loc_uptown', name: 'Uptown Mall', type: 'region' },
    ]
};

// (rest of seed file unchanged — only ROLES.SUPER_ADMIN was patched)
