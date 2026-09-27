import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authAPI = vi.hoisted(() => ({
    login: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
}));
const api = vi.hoisted(() => ({
    getPricingConfig: vi.fn(),
    getScreens: vi.fn(),
    getStores: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: (_auth, callback) => {
        callback(null);
        return () => {};
    },
}));
vi.mock('../firebase', () => ({ auth: {} }));
vi.mock('../services/authAPI', () => ({ authAPI }));
vi.mock('../services/ApiService', () => ({ default: api }));

import { AuthProvider, useAuth } from './AuthContext';
import pricingService from '../services/PricingService';

function renderAuth() {
    const session = {};
    function Probe() {
        Object.assign(session, useAuth());
        return null;
    }
    render(<AuthProvider><Probe /></AuthProvider>);
    return session;
}

describe('AuthProvider logout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pricingService.config = null;
        pricingService.screens = [];
        pricingService.stores = [];
        authAPI.login.mockResolvedValue({ user: { id: 'brand-1', role: 'brand' } });
        authAPI.logout.mockResolvedValue();
        api.getScreens.mockResolvedValue([]);
        api.getStores.mockResolvedValue([]);
    });

    it('makes the next login in the same tab fetch current pricing', async () => {
        const session = renderAuth();
        api.getPricingConfig.mockResolvedValue({ baseCPM: 10 });
        await act(() => session.login('brand@example.com', 'secret'));
        await pricingService.init();
        expect(pricingService.getBaseCPM()).toBe(10);

        api.getPricingConfig.mockResolvedValue({ baseCPM: 15 });
        await act(() => session.logout());
        await act(() => session.login('brand@example.com', 'secret'));
        await pricingService.init();

        expect(api.getPricingConfig).toHaveBeenCalledTimes(2);
        expect(pricingService.getBaseCPM()).toBe(15);
    });

    it('drops the previous user’s bookable Screens and Stores', async () => {
        const session = renderAuth();
        await act(() => session.login('brand@example.com', 'secret'));
        pricingService.configureBookableInventory([{
            screen: { id: 'screen-1' },
            store: { id: 'store-1' },
            retailer: { id: 'retailer-1' },
            booking_price: { base: 12 },
        }]);

        await act(() => session.logout());

        expect(pricingService.config).toBeNull();
        expect(pricingService.screens).toEqual([]);
        expect(pricingService.stores).toEqual([]);
    });
});
