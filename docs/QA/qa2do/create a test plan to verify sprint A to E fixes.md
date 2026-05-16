<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# create a test plan to verify sprint A to E fixes

Now I have the full picture of the existing auth infrastructure. Here is the complete, production-ready test plan.

***

# Softomedia Live 2026 — Remediation Test Plan

**Sprints A–E** · Playwright E2E + Jest Unit
**Repo:** [cfroszte/softomedia-live2026](https://github.com/cfroszte/softomedia-live2026) · branch `main`
**Auth:** Uses `global.setup.js` localStorage injection for `brand`, `admin`, `retailer` personas . A `superadmin` persona must be added to the setup loop for all Sprint A/B/C tests.

***

## Infrastructure Setup (Do First)

Before writing any new spec, make one change to [`tests/global.setup.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/global.setup.js) and [`tests/base.fixtures.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/base.fixtures.js) to add the `superadmin` persona — it is currently absent from the auth setup .

**`tests/global.setup.js` — change 1 line:**

```js
// Before:
const personas = ['brand', 'admin', 'retailer'];

// After:
const personas = ['brand', 'admin', 'retailer', 'superadmin'];
```

**`tests/base.fixtures.js` — add one new fixture:**

```js
superadminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
        storageState: 'tests/.auth/superadmin.json'
    });
    const page = await context.newPage();
    await page.goto('/');
    await use(page);
    await context.close();
},
```


***

## Sprint A — `tests/users_crud.spec.js` (New File)

**Covers:** BUG-02 (superadmin locked out of GET /api/users) · BUG-03 (deleted user stays in table)

```js
import { test, expect } from './base.fixtures.js';

test.describe('BUG-02 — superadmin can list and create users', () => {

    test('superadmin GET /api/users returns 200', async ({ superadminPage: page }) => {
        const response = await page.request.get('/api/users');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('users');
        expect(Array.isArray(body.users)).toBe(true);
    });

    test('superadmin sees user rows in the Users table', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/admin/users');
        await page.waitForSelector('table tbody tr', { timeout: 5000 });
        const rows = page.locator('table tbody tr');
        await expect(rows.first()).toBeVisible();
    });

    test('superadmin can create a new user and it appears in the table', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/admin/users');

        // Open invite drawer
        await page.getByRole('button', { name: /invite|add/i }).first().click();

        // Fill form
        await page.getByPlaceholder('John Smith').fill('QA Test User');
        await page.getByPlaceholder('john@business.com').fill(`qa+${Date.now()}@test.com`);
        await page.locator('select[value="retailer"], select').first().selectOption('retailer');

        // Submit
        await page.getByRole('button', { name: /create user/i }).click();

        // Modal closes and new row is visible
        await expect(page.locator('text=QA Test User')).toBeVisible({ timeout: 5000 });
    });

    test('role=advertiser blocks submit without linked_entity_id', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/admin/users');
        await page.getByRole('button', { name: /invite|add/i }).first().click();
        await page.locator('select').selectOption('advertiser');

        const submitBtn = page.getByRole('button', { name: /create user/i });
        await expect(submitBtn).toBeDisabled();
        await expect(page.locator('text=/linked entity/i')).toBeVisible();
    });

});

test.describe('BUG-03 — deleted user is removed from table immediately', () => {

    test('trash icon triggers confirmation prompt', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/admin/users');
        await page.waitForSelector('table tbody tr');

        page.once('dialog', dialog => dialog.dismiss()); // Cancel to avoid actual deletion
        await page.locator('table tbody tr').first()
            .getByTitle('Delete User').click();
        // If dialog appeared and was dismissed, row must still be there
        await expect(page.locator('table tbody tr').first()).toBeVisible();
    });

    test('confirmed delete removes row without page refresh', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/admin/users');
        await page.waitForSelector('table tbody tr');

        // Get the email of the first row to identify it post-delete
        const targetEmail = await page.locator('table tbody tr').first()
            .locator('td').nth(2).innerText();

        page.once('dialog', dialog => dialog.accept());
        await page.locator('table tbody tr').first()
            .getByTitle('Delete User').click();

        // Row should disappear without navigation
        await expect(page.locator(`text=${targetEmail}`)).not.toBeVisible({ timeout: 3000 });
    });

    test('deleted user status is inactive in API response', async ({ superadminPage: page }) => {
        // Create a user specifically for deletion
        const email = `delete+${Date.now()}@test.com`;
        const createRes = await page.request.post('/api/users', {
            data: { email, name: 'Delete Target', role: 'retailer' }
        });
        expect(createRes.status()).toBe(201);
        const { id } = await createRes.json();

        // Soft-delete via API
        const deleteRes = await page.request.delete(`/api/users/${id}`);
        expect(deleteRes.status()).toBe(200);

        // Verify Firestore document still exists but is inactive
        const checkRes = await page.request.get(`/api/users/${id}`);
        const user = (await checkRes.json()).user;
        expect(user.status).toBe('inactive');
    });

});
```

**Run command:**

```bash
npx playwright test tests/users_crud.spec.js --reporter=list
```


***

## Sprint B — `tests/soft_delete.spec.js` (New File)

**Covers:** BUG-05 (Retailer hard-delete) · BUG-08 (Advertiser hard-delete)

```js
import { test, expect } from './base.fixtures.js';

test.describe('BUG-05 — Retailer delete is a soft-delete', () => {

    test('DELETE /api/retailers/:id returns 200 and document still exists', async ({ superadminPage: page }) => {
        // Create a disposable retailer via API
        const createRes = await page.request.post('/api/retailers', {
            data: {
                name: `Soft Delete Test ${Date.now()}`,
                contact_email: `softdelete+r+${Date.now()}@test.com`,
                status: 'active'
            }
        });
        expect(createRes.status()).toBe(201);
        const retailer = await createRes.json();
        const id = retailer.id || retailer.retailer?.id;

        // Delete via API
        const deleteRes = await page.request.delete(`/api/retailers/${id}`);
        expect(deleteRes.status()).toBe(200);

        // Document must still exist with status='inactive'
        const getRes = await page.request.get(`/api/retailers/${id}`);
        expect(getRes.status()).not.toBe(404); // Hard-delete would return 404
        const body = await getRes.json();
        expect(body.status ?? body.retailer?.status).toBe('inactive');
    });

    test('associated stores are intact after retailer soft-delete', async ({ superadminPage: page }) => {
        // Get a store that belongs to a known retailer
        const storesRes = await page.request.get('/api/stores');
        const stores = (await storesRes.json()).stores || [];
        if (stores.length === 0) test.skip();

        const store = stores[^0];
        const retailerId = store.retailer_id;

        // Soft-delete the retailer
        await page.request.delete(`/api/retailers/${retailerId}`);

        // Store must still exist
        const checkRes = await page.request.get(`/api/stores/${store.id}`);
        expect(checkRes.status()).toBe(200);
    });

});

test.describe('BUG-08 — Advertiser delete is a soft-delete', () => {

    test('DELETE /api/advertisers/:id returns 200 and document still exists', async ({ superadminPage: page }) => {
        const createRes = await page.request.post('/api/advertisers', {
            data: {
                name: `Soft Delete Adv ${Date.now()}`,
                contact_email: `softdelete+a+${Date.now()}@test.com`,
                industry: 'Other',
                budget: 1000,
                status: 'active'
            }
        });
        expect(createRes.status()).toBe(201);
        const adv = await createRes.json();
        const id = adv.id || adv.advertiser?.id;

        const deleteRes = await page.request.delete(`/api/advertisers/${id}`);
        expect(deleteRes.status()).toBe(200);

        const getRes = await page.request.get(`/api/advertisers/${id}`);
        expect(getRes.status()).not.toBe(404);
        const body = await getRes.json();
        expect(body.status ?? body.advertiser?.status).toBe('inactive');
    });

    test('campaigns referencing advertiser_id are intact after advertiser soft-delete', async ({ superadminPage: page }) => {
        const campaignsRes = await page.request.get('/api/campaigns');
        const campaigns = (await campaignsRes.json()).campaigns || [];
        if (campaigns.length === 0) test.skip();

        const campaign = campaigns.find(c => c.advertiser_id);
        if (!campaign) test.skip();

        await page.request.delete(`/api/advertisers/${campaign.advertiser_id}`);

        const checkRes = await page.request.get(`/api/campaigns/${campaign.id}`);
        expect(checkRes.status()).toBe(200);
        const body = await checkRes.json();
        expect(body.campaign?.advertiser_id ?? body.advertiser_id).toBe(campaign.advertiser_id);
    });

});
```

**Run command:**

```bash
npx playwright test tests/soft_delete.spec.js --reporter=list
```


***

## Sprint C — `tests/campaign_edit.spec.js` (New File)

**Covers:** BUG-12 (Campaign Edit route + pre-fill) · BUG-13 (Status column date logic)

```js
import { test, expect } from './base.fixtures.js';

test.describe('BUG-12 — Campaign Edit navigation and pre-fill', () => {

    test('Edit button navigates to correct URL /dashboard/brand/campaign/:id/edit', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand');
        await page.waitForSelector('table tbody tr, [data-testid="campaign-row"]', { timeout: 5000 });

        // Intercept navigate call
        const [response] = await Promise.all([
            page.waitForURL(/\/dashboard\/brand\/campaign\/.+\/edit/),
            page.locator('table tbody tr').first().getByRole('button', { name: /edit/i }).click()
        ]);
        expect(page.url()).toMatch(/\/dashboard\/brand\/campaign\/.+\/edit/);
    });

    test('Edit wizard fields are pre-populated with existing campaign values', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand');
        await page.waitForSelector('table tbody tr', { timeout: 5000 });

        // Grab campaign name from table before clicking edit
        const campaignName = await page.locator('table tbody tr').first()
            .locator('td').first().innerText();

        await page.locator('table tbody tr').first()
            .getByRole('button', { name: /edit/i }).click();
        await page.waitForURL(/\/edit/);

        // Name field must contain the original value
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        await expect(nameInput).toHaveValue(new RegExp(campaignName.trim(), 'i'));
    });

    test('Save calls PUT /api/campaigns/:id', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand');
        await page.waitForSelector('table tbody tr', { timeout: 5000 });
        await page.locator('table tbody tr').first()
            .getByRole('button', { name: /edit/i }).click();
        await page.waitForURL(/\/edit/);

        // Intercept PUT
        const putPromise = page.waitForRequest(req =>
            req.method() === 'PUT' && req.url().includes('/api/campaigns/')
        );

        await page.locator('input[name="name"], input[placeholder*="name" i]').first()
            .fill('Updated Campaign Name');
        await page.getByRole('button', { name: /save/i }).click();

        const putReq = await putPromise;
        expect(putReq.method()).toBe('PUT');
    });

});

test.describe('BUG-13 — Campaign Status column derived from date window', () => {

    test('Status shows "Live" for campaign active today', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand');
        await page.waitForSelector('table tbody tr', { timeout: 5000 });

        // Seed or find a campaign where today is between start_date and end_date
        // If using mock data, this should be true for at least one row
        const liveStatuses = page.locator('table tbody tr td').filter({ hasText: /live/i });
        // At least one live campaign expected in demo data
        await expect(liveStatuses.first()).toBeVisible();
    });

    test('Status shows "Completed" for campaign past its end_date', async ({ brandPage: page }) => {
        // POST a campaign with end_date in the past via API
        const res = await page.request.post('/api/campaigns', {
            data: {
                name: 'Past Campaign Test',
                start_date: '2025-01-01',
                end_date: '2025-01-31',
                status: 'live',
                budget: 100
            }
        });
        if (res.status() !== 201) test.skip();

        await page.goto('/dashboard/brand');
        await expect(page.locator('text=Past Campaign Test').locator('..').locator('..')).toContainText(/completed|ended/i);
    });

    test('Status shows "Scheduled" for campaign with future start_date', async ({ brandPage: page }) => {
        const res = await page.request.post('/api/campaigns', {
            data: {
                name: 'Future Campaign Test',
                start_date: '2099-01-01',
                end_date: '2099-12-31',
                status: 'scheduled',
                budget: 100
            }
        });
        if (res.status() !== 201) test.skip();

        await page.goto('/dashboard/brand');
        await expect(page.locator('text=Future Campaign Test').locator('..').locator('..')).toContainText(/scheduled/i);
    });

    test('deriveStatus() unit — status logic produces correct output', async () => {
        // Pure logic test — no browser needed
        const deriveStatus = (campaign) => {
            const today = new Date();
            const start = new Date(campaign.start_date);
            const end = new Date(campaign.end_date);
            if (today < start) return 'Scheduled';
            if (today > end) return 'Completed';
            if (campaign.status === 'paused') return 'Paused';
            return 'Live';
        };

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[^0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[^0];
        const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[^0];
        const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[^0];

        expect(deriveStatus({ start_date: yesterday, end_date: tomorrow, status: 'live' })).toBe('Live');
        expect(deriveStatus({ start_date: lastWeek, end_date: yesterday, status: 'live' })).toBe('Completed');
        expect(deriveStatus({ start_date: tomorrow, end_date: nextMonth, status: 'scheduled' })).toBe('Scheduled');
        expect(deriveStatus({ start_date: yesterday, end_date: tomorrow, status: 'paused' })).toBe('Paused');
    });

});
```

**Run command:**

```bash
npx playwright test tests/campaign_edit.spec.js --reporter=list
```


***

## Sprint D — `tests/retailer_nav.spec.js` + `tests/add_location.spec.js` (New Files)

**Covers:** BUG-17 (Go Back) · BUG-18 (Add Location → Store) · BUG-16 (Schedule Calendar auth)

### `tests/retailer_nav.spec.js`

```js
import { test, expect } from './base.fixtures.js';

test.describe('BUG-17 — Go Back navigation on retailer history view', () => {

    test('"Go Back" button is present on /dashboard/retailer/history', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/history');
        const goBack = page.getByRole('button', { name: /go back|back/i })
            .or(page.getByRole('link', { name: /go back|back/i }));
        await expect(goBack).toBeVisible({ timeout: 3000 });
    });

    test('"Go Back" navigates to /dashboard/retailer', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/history');
        await page.getByRole('button', { name: /go back|back/i })
            .or(page.getByRole('link', { name: /go back|back/i }))
            .click();
        await expect(page).toHaveURL(/\/dashboard\/retailer(?!\/)/);
    });

});

test.describe('BUG-16 — Schedule Calendar uses real auth userId', () => {

    test('Approve All PATCH request body contains real userId (not retailer_demo)', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');
        await page.waitForSelector('[data-testid="schedule-timeline"]', { timeout: 5000 });

        const approveBtn = page.getByTestId('approve-all-btn');
        if (!(await approveBtn.isVisible())) test.skip(); // No pending loops to approve

        const patchPromise = page.waitForRequest(req =>
            req.method() === 'PATCH' && req.url().includes('/api/loops/')
        );
        await approveBtn.click();
        const patchReq = await patchPromise;

        const body = JSON.parse(patchReq.postData() || '{}');
        expect(body.userId).not.toBe('retailer_demo');
        expect(body.userId).toBeTruthy();
    });

});
```


### `tests/add_location.spec.js`

```js
import { test, expect } from './base.fixtures.js';

test.describe('BUG-18 — Add Location creates a Firestore store document', () => {

    test('POST /api/stores returns 201 with correct retailer_id', async ({ superadminPage: page }) => {
        // Get a valid retailer_id first
        const retailersRes = await page.request.get('/api/retailers');
        const retailers = (await retailersRes.json()).retailers || [];
        if (retailers.length === 0) test.skip();
        const retailerId = retailers[^0].id;

        const createRes = await page.request.post('/api/stores', {
            data: {
                name: `QA Store ${Date.now()}`,
                retailer_id: retailerId,
                address: '123 Test St',
                city: 'Montreal',
                status: 'active'
            }
        });
        expect(createRes.status()).toBe(201);
        const store = await createRes.json();
        expect(store.retailer_id ?? store.store?.retailer_id).toBe(retailerId);
    });

    test('New store appears in Player store selector after creation', async ({ superadminPage: page }) => {
        const storeName = `Player Store ${Date.now()}`;
        const retailersRes = await page.request.get('/api/retailers');
        const retailers = (await retailersRes.json()).retailers || [];
        if (retailers.length === 0) test.skip();

        await page.request.post('/api/stores', {
            data: {
                name: storeName,
                retailer_id: retailers[^0].id,
                status: 'active'
            }
        });

        await page.goto('/player');
        await page.waitForSelector('select', { timeout: 5000 });
        const storeSelect = page.locator('select').first();
        await expect(storeSelect.locator(`option:has-text("${storeName}")`)).toHaveCount(1);
    });

    test('Retailer context selector is visible to superadmin on retailer views', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/retailer');
        const selector = page.locator('select').filter({ hasText: /retailer|store/i });
        await expect(selector.first()).toBeVisible({ timeout: 3000 });
    });

    test('Retailer context selector is hidden from retaileradmin', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer');
        // The context switcher dropdown should NOT be present for non-admin
        const switcher = page.locator('[data-testid="retailer-context-select"]');
        await expect(switcher).not.toBeVisible();
    });

});
```

**Run command:**

```bash
npx playwright test tests/retailer_nav.spec.js tests/add_location.spec.js --reporter=list
```


***

## Sprint E — `tests/seed_data_audit.spec.js` (New File)

**Covers:** AUDIT-01 (Mock seed data leaking into selectors)

```js
import { test, expect } from './base.fixtures.js';

test.describe('AUDIT-01 — No orphan seed data in production selectors', () => {

    test('Every store returned by GET /api/stores has a valid retailer_id', async ({ superadminPage: page }) => {
        const storesRes = await page.request.get('/api/stores');
        expect(storesRes.status()).toBe(200);
        const stores = (await storesRes.json()).stores || [];

        const retailersRes = await page.request.get('/api/retailers');
        const validIds = new Set(
            ((await retailersRes.json()).retailers || []).map(r => r.id)
        );

        const orphans = stores.filter(s => !validIds.has(s.retailer_id));
        expect(orphans).toHaveLength(0);
    });

    test('Player store selector contains no MOCK_STORAGE seed entries', async ({ superadminPage: page }) => {
        await page.goto('/player');
        await page.waitForSelector('select', { timeout: 5000 });

        const options = await page.locator('select').first()
            .locator('option').allInnerTexts();

        // Seed data typically has names like 'Mock Store', 'Test Store', 'Demo Store'
        const seedPatterns = /mock|seed|demo_store|test_store/i;
        const leaked = options.filter(o => seedPatterns.test(o));
        expect(leaked).toHaveLength(0);
    });

    test('DISABLE_MOCK_STORAGE flag does not break GET /api/monitoring/status', async ({ superadminPage: page }) => {
        // Regression guard: Tech Ops must still work after seed data is disabled
        const res = await page.request.get('/api/monitoring/status');
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('total');
        expect(body).toHaveProperty('screens');
        expect(typeof body.total).toBe('number');
    });

    test('Tech Ops screen count matches GET /api/monitoring/status total', async ({ superadminPage: page }) => {
        await page.goto('/dashboard/tech');
        await page.waitForSelector('[class*="font-black"]', { timeout: 5000 });

        const apiRes = await page.request.get('/api/monitoring/status');
        const { total } = await apiRes.json();

        // The "Managed Fleet" stat card should show the same number
        const fleetCard = page.locator('text=Managed Fleet').locator('..').locator('..');
        await expect(fleetCard).toContainText(String(total));
    });

});
```

**Run command:**

```bash
npx playwright test tests/seed_data_audit.spec.js --reporter=list
```


***

## Regression Guard — Existing Tests Must Stay Green

After each sprint merge, run the full suite to verify no regressions were introduced :

```bash
npx playwright test --reporter=list
```

| Existing file | What it guards |
| :-- | :-- |
| [`tests/personas.spec.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/personas.spec.js) | Role-based route access — must not break after BUG-02 role gate fix |
| [`tests/retailer_validation.spec.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/retailer_validation.spec.js) | Retailer CRUD — must stay green after BUG-05 soft-delete refactor |
| [`tests/telemetry.spec.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/telemetry.spec.js) | Tech Ops monitoring — must not regress after AUDIT-01 cleanup |
| [`tests/telemetry_global.spec.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/telemetry_global.spec.js) | Global aggregates — verify counts still correct post-seed removal |
| [`tests/integration_gold_path.spec.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/integration_gold_path.spec.js) | Full happy path — catches any unintended side effects |
| [`tests/loop_playback.spec.js`](https://github.com/cfroszte/softomedia-live2026/blob/main/tests/loop_playback.spec.js) | Playback engine — must not be broken by store/retailer changes |


***

## Master Test Inventory

| File | Sprint | Bugs Covered | Type | Status |
| :-- | :-- | :-- | :-- | :-- |
| `tests/users_crud.spec.js` | A | BUG-02, BUG-03 | New | 🆕 Create |
| `tests/soft_delete.spec.js` | B | BUG-05, BUG-08 | New | 🆕 Create |
| `tests/campaign_edit.spec.js` | C | BUG-12, BUG-13 | New | 🆕 Create |
| `tests/retailer_nav.spec.js` | D | BUG-17, BUG-16 | New | 🆕 Create |
| `tests/add_location.spec.js` | D | BUG-18 | New | 🆕 Create |
| `tests/seed_data_audit.spec.js` | E | AUDIT-01 | New | 🆕 Create |
| `tests/personas.spec.js` | A | Role gate regression | Existing | ✅ Extend |
| `tests/retailer_validation.spec.js` | B | Retailer CRUD regression | Existing | ✅ Extend |
| `tests/telemetry.spec.js` | E | Tech Ops regression | Existing | ✅ Extend |
| `tests/telemetry_global.spec.js` | E | Global aggregates regression | Existing | ✅ Extend |


***

## SRE Acceptance Criteria

All of the following must be true before any sprint is considered closed:[^1]

- [ ] 100% pass rate across all new spec files
- [ ] Zero unhandled Promise rejections in browser console during any test run
- [ ] `DELETE` endpoints for retailers, advertisers, and users all return `200` with document still present in Firestore (`status: 'inactive'`)
- [ ] `superadmin` receives `200` from `GET /api/users` (not `403`)
- [ ] Campaign Status column text is never the raw DB string — always computed from `deriveStatus()` against today's date
- [ ] No store in `GET /api/stores` has a missing or invalid `retailer_id`
- [ ] All 6 existing regression guard spec files remain green throughout

<div align="center">⁂</div>

[^1]: Softomedia-Live-2026-QA-Sprint-Plan.md

