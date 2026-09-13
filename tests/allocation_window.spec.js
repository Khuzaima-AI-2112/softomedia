const { test, expect } = require('@playwright/test');

function buildAllocationLoops() {
    // Independent worked example: per-hour distributions total 42/12/6.
    const categoriesByLoop = [
        'pprppipprppp',
        'rppipprppprp',
        'pipprppprppi',
        'pprppprppipp',
        'rppprppipprp',
    ];
    const categoryName = { p: 'paid', r: 'retailer', i: 'internal' };
    return Array.from({ length: 5 }, (_, loopIndex) => ({
        id: `2030-01-02_${8 + loopIndex}_store-1`,
        date: '2030-01-02',
        hour: 8 + loopIndex,
        retailer_id: 'retailer-1',
        store_id: 'store-1',
        status: 'pending_approval',
        slots: Array.from({ length: 12 }, (_, position) => {
            const allocated_category = categoryName[categoriesByLoop[loopIndex][position]];
            const is_fallback = allocated_category === 'internal' && position % 2 === 1;
            const is_media = allocated_category === 'retailer';
            return {
                position,
                duration: 5,
                allocated_category,
                asset_id: is_fallback ? 'fallback-asset' : `${allocated_category}-asset`,
                campaign_id: is_fallback || is_media ? null : `${allocated_category}-campaign`,
                content_kind: is_fallback ? 'fallback' : is_media ? 'media' : 'campaign',
                is_fallback,
                status: 'pending',
            };
        }),
    }));
}

test('Admin generates and reports a deterministic five-loop Allocation Window', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-13T12:00:00.000Z'));
    const loops = buildAllocationLoops();
    let generated = false;

    await page.addInitScript(() => {
        window.ENV = {
            VITE_API_URL: 'http://localhost:8080',
            VITE_FIREBASE_PROJECT_ID: 'softomedia-demo',
            VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
        };
    });
    const jwt = [
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({
            aud: 'softomedia-demo',
            auth_time: 1789300800,
            email: 'admin@softomedia.demo',
            exp: 1789304400,
            firebase: { sign_in_provider: 'password' },
            iat: 1789300800,
            iss: 'https://securetoken.google.com/softomedia-demo',
            sub: 'admin-uid',
            user_id: 'admin-uid',
        })).toString('base64url'),
        'test-signature',
    ].join('.');
    await page.route('**/identitytoolkit.googleapis.com/**', route => {
        if (route.request().url().includes('accounts:lookup')) {
            return route.fulfill({
                status: 200,
                json: {
                    kind: 'identitytoolkit#GetAccountInfoResponse',
                    users: [{
                        localId: 'admin-uid',
                        email: 'admin@softomedia.demo',
                        emailVerified: true,
                        displayName: 'Test Admin',
                        providerUserInfo: [],
                        createdAt: '1789300800000',
                        lastLoginAt: '1789300800000',
                    }],
                },
            });
        }
        return route.fulfill({
            status: 200,
            json: {
                kind: 'identitytoolkit#VerifyPasswordResponse',
                localId: 'admin-uid',
                email: 'admin@softomedia.demo',
                displayName: 'Test Admin',
                idToken: jwt,
                registered: true,
                refreshToken: 'test-refresh-token',
                expiresIn: '3600',
            },
        });
    });
    await page.route('**/api/auth/me', route => route.fulfill({
        status: 200,
        json: { user: { id: 'admin-uid', email: 'admin@softomedia.demo', role: 'admin' } },
    }));

    await page.route('**/api/stores**', route => route.fulfill({
        status: 200,
        json: [{ id: 'store-1', retailer_id: 'retailer-1', name: 'Test Store' }],
    }));
    await page.route('**/api/loops**', async route => {
        const request = route.request();
        if (request.url().includes('/generate') && request.method() === 'POST') {
            expect(request.postDataJSON().mock).not.toBe(true);
            generated = true;
            return route.fulfill({
                status: 201,
                json: {
                    loops,
                    business_hours: { start: 8, end: 13, is_closed: false, total_loops: 5 },
                },
            });
        }
        return route.fulfill({
            status: 200,
            json: {
                loops: generated ? loops : [],
                business_hours: { start: 8, end: 13, is_closed: false, total_loops: 5 },
            },
        });
    });

    await page.goto('/login');
    await page.getByTestId('input-email').fill('admin@softomedia.demo');
    await page.getByTestId('input-password').fill('test-password');
    await page.getByTestId('btn-login').click();
    await expect(page).toHaveURL(/\/dashboard\/admin/);
    await page.goto('/dashboard/admin/loops');
    await page.getByTestId('generate-loops-btn').click();

    const summary = page.getByTestId('allocation-summary');
    await expect(summary).toContainText('Paid42');
    await expect(summary).toContainText('Retailer12');
    await expect(summary).toContainText('Internal6');
    await expect(summary).toContainText(/Campaign content/i);
    await expect(summary).toContainText(/Media content/i);
    await expect(summary).toContainText(/Fallback content/i);
    await expect(page.getByTestId('loop-hour-12')).toBeVisible();
    await expect(page.getByTestId('loop-hour-13')).not.toBeVisible();
});
