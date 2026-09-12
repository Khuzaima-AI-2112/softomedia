import { test, expect } from '@playwright/test';
import { BASE_URL, DEMO_TOKEN, DEMO_RETAILER } from './fixtures/personas.js';

test('Retailer Administrator sees only its stores, their local time zone, and newly added locations', async ({ page }) => {
    const stores = [{
        id: 'freshmart-toronto',
        name: 'FreshMart Toronto',
        retailer_id: DEMO_RETAILER.linkedEntityId,
        time_zone: 'America/Toronto',
    }];
    const locations = [{
        id: 'entrance',
        name: 'Entrance',
        store_id: 'freshmart-toronto',
        retailer_id: DEMO_RETAILER.linkedEntityId,
    }];

    await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.route('**/api/stores', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON();
            stores.push({ id: 'new-store', ...body });
            return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(stores.at(-1)) });
        }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(stores) });
    });
    await page.route('**/api/locations', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON();
            const created = { id: 'checkout', retailer_id: DEMO_RETAILER.linkedEntityId, ...body };
            locations.push(created);
            return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
        }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(locations) });
    });
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(({ role, token, user }) => {
        localStorage.setItem('demo_role', role);
        localStorage.setItem('active_persona', role);
        localStorage.setItem('authToken', token);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    }, {
        role: DEMO_RETAILER.role,
        token: DEMO_TOKEN,
        user: {
            id: DEMO_RETAILER.id,
            email: DEMO_RETAILER.email,
            role: DEMO_RETAILER.role,
            linked_entity_id: DEMO_RETAILER.linkedEntityId,
        },
    });

    await page.goto(`${BASE_URL}/dashboard/retailer`);
    await expect(page.getByTestId('retailer-store-manager')).toBeVisible();
    await expect(page.getByTestId('store-time-zone-freshmart-toronto')).toHaveText('Time zone: America/Toronto');
    await expect(page.getByText('Entrance')).toBeVisible();

    await page.getByTestId('add-location-button').click();
    await page.getByTestId('location-name-input').fill('Checkout');
    await page.getByTestId('add-location-form').getByRole('button', { name: 'Create Location' }).click();

    await expect(page.getByText('Checkout')).toBeVisible();
});
