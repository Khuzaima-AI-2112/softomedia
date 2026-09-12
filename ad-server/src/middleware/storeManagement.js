import { ROLES, normalizeRole } from '../constants/roles.js';
import StoreRepository from '../repositories/StoreRepository.js';

const STORE_MANAGEMENT_ROLES = new Set([
    ROLES.RETAILERADMIN,
    ROLES.ADMIN,
    ROLES.SUPERADMIN,
]);

const NETWORK_STORE_MANAGER_ROLES = new Set([
    ROLES.ADMIN,
    ROLES.SUPERADMIN,
]);

export function retailerIdFor(user) {
    return user?.linked_entity_id || user?.linkedentityid || user?.retailer_id || null;
}

export function canManageAnyRetailer(user) {
    return NETWORK_STORE_MANAGER_ROLES.has(normalizeRole(user?.role));
}

export function canManageRetailer(user, retailerId) {
    const role = normalizeRole(user?.role);
    if (!STORE_MANAGEMENT_ROLES.has(role)) return false;
    return NETWORK_STORE_MANAGER_ROLES.has(role) || retailerIdFor(user) === retailerId;
}

/** A generic denial deliberately does not reveal whether a foreign record exists. */
export function denyStoreAccess(res) {
    return res.status(403).json({ error: 'Access denied' });
}

export async function findManagedStore(req, res, storeId) {
    const store = await StoreRepository.findById(storeId);
    if (!store || !canManageRetailer(req.user, store.retailer_id)) {
        denyStoreAccess(res);
        return null;
    }
    return store;
}
