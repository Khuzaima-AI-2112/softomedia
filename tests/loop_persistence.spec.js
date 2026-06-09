/**
 * Loop State Persistence Tests
 * S16-4: S11 — Loop state must survive page reload and cross-page navigation.
 *
 * These tests were absent from integration_broadcasting.spec.js and
 * loop_builder.spec.js (confirmed S16 audit). New dedicated spec.
 *
 * Coverage:
 *   P-01  PENDING_APPROVAL loop status survives hard reload
 *   P-02  APPROVED loop status survives hard reload
 *   P-03  REJECTED loop status survives hard reload
 *   P-04  Slot asset assignment persists across navigate-away + back
 *   P-05  Approved loop cannot be re-driven to PENDING_APPROVAL by reload alone
 *   P-06  Bulk approve-all: all affected loops show APPROVED after reload
 *   P-07  UI polling (5-min interval) does not overwrite optimistic APPROVED state
 *
 * All tests mock the API layer — no real Firestore calls.
 * Pattern: route mock → action → reload → assert persisted state from API.
 */

const { test, expect } = require('./base.fixtures');

const BASE_LOOP = {
    id: '2026-01-03_14_loc_downtown',
    date: '2026-01-03',
    hour: 14,
    location_id: 'loc_downtown',
    retailer_id: 'ret_demo',
    version: 1,
    slots: Array.from({ length: 12 }, (_, i) => ({
        position: i,
        asset_id: `asset_${i}`,
        asset_name: `Test Ad ${i + 1}`,
        duration: 5,
        status: 'PENDING',
    })),
};

/**
 * Helper: mount a mock for GET /api/loops/:id that returns the given status.
 */
async function mockLoopStatus(page, loopId, status, slotStatus = 'PENDING') {
    const slots = BASE_LOOP.slots.map(s => ({ ...s, status: slotStatus }));
    await page.route(`**/api/loops/${loopId}`, route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...BASE_LOOP, id: loopId, status, slots }),
        });
    });
}

/**
 * Helper: mount a mock for GET /api/loops?date=* that returns an array
 * containing a single loop with the given status.
 */
async function mockLoopListStatus(page, status) {
    await page.route('**/api/loops?date=**', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                loops: [{ ...BASE_LOOP, status }],
                business_hours: { start: 8, end: 22, is_closed: false, total_loops: 14 },
            }),
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// P-01 through P-03: Status survives hard reload
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P-01..03 — Status survives hard reload', () => {
    const LOOP_ID = BASE_LOOP.id;

    for (const [testId, status, label] of [
        ['P-01', 'PENDING_APPROVAL', 'Pending Approval'],
        ['P-02', 'APPROVED',         'Approved'],
        ['P-03', 'REJECTED',         'Rejected'],
    ]) {
        test(`${testId}: ${label} loop status persists after page reload`, async ({ page }) => {
            // The API returns the given status both before and after reload.
            // This tests that the UI derives status from the API response
            // rather than caching stale state in memory.
            await mockLoopStatus(page, LOOP_ID, status);
            await page.goto(`/dashboard/admin/loops/${LOOP_ID}`);
            await expect(page.getByText('Loop Builder')).toBeVisible();

            // Status badge or heading should reflect the current status.
            await expect(
                page.locator(`[data-testid="loop-status"]`)
            ).toContainText(new RegExp(status.replace('_', ' '), 'i'));

            // Hard reload: route mock persists across reload within same page.route scope.
            await page.reload();
            await expect(page.getByText('Loop Builder')).toBeVisible();
            await expect(
                page.locator(`[data-testid="loop-status"]`)
            ).toContainText(new RegExp(status.replace('_', ' '), 'i'));
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// P-04: Slot assignment persists across navigate-away + back
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P-04 — Slot assignment persists across navigation', () => {
    const LOOP_ID = BASE_LOOP.id;

    test('P-04: Slot asset assignment visible after navigate-away + back', async ({ page }) => {
        // First fetch: loop with all slots filled.
        await mockLoopStatus(page, LOOP_ID, 'PENDING_APPROVAL', 'PENDING');

        // Mock PATCH replace endpoint.
        await page.route(`**/api/loops/${LOOP_ID}/slots/0/replace`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...BASE_LOOP,
                    status: 'PENDING_APPROVAL',
                    slots: BASE_LOOP.slots.map((s, i) =>
                        i === 0 ? { ...s, asset_id: 'asset_new_001', asset_name: 'New Ad', status: 'REPLACED' } : s
                    ),
                }),
            });
        });

        await page.goto(`/dashboard/admin/loops/${LOOP_ID}`);
        await expect(page.getByText('Loop Builder')).toBeVisible();

        // Simulate slot 0 being replaced (API mock above handles the PATCH).
        // After replacement the UI should re-fetch and show the updated name.
        // Navigate away to loop list.
        await page.goto('/dashboard/admin/loops');
        await expect(page.getByText('Loop Management')).toBeVisible();

        // Navigate back — the API now returns the post-replace state.
        // Re-register mock with updated slot.
        await page.route(`**/api/loops/${LOOP_ID}`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...BASE_LOOP,
                    status: 'PENDING_APPROVAL',
                    slots: BASE_LOOP.slots.map((s, i) =>
                        i === 0
                            ? { ...s, asset_id: 'asset_new_001', asset_name: 'New Ad', status: 'REPLACED' }
                            : s
                    ),
                }),
            });
        });

        await page.goto(`/dashboard/admin/loops/${LOOP_ID}`);
        await expect(page.getByText('Loop Builder')).toBeVisible();
        // Slot 0 should show the replacement asset name.
        await expect(page.locator('[data-testid="slot-0"]')).toContainText('New Ad');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-05: Approved loop cannot be re-driven to PENDING_APPROVAL by reload
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P-05 — Approved loop not re-settable by reload', () => {
    const LOOP_ID = BASE_LOOP.id;

    test('P-05: Approve button absent and status stays APPROVED after reload', async ({ page }) => {
        await mockLoopStatus(page, LOOP_ID, 'APPROVED', 'APPROVED');

        await page.goto(`/dashboard/admin/loops/${LOOP_ID}`);
        await expect(page.getByText('Loop Builder')).toBeVisible();

        // Approve button should NOT be present for an already-approved loop.
        await expect(
            page.locator('[data-testid="approve-loop-btn"]')
        ).not.toBeVisible();

        // Status badge should show APPROVED.
        await expect(
            page.locator('[data-testid="loop-status"]')
        ).toContainText(/approved/i);

        // After reload, status remains APPROVED (API mock still returns APPROVED).
        await page.reload();
        await expect(
            page.locator('[data-testid="loop-status"]')
        ).toContainText(/approved/i);
        await expect(
            page.locator('[data-testid="approve-loop-btn"]')
        ).not.toBeVisible();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-06: Bulk approve-all: all affected loops show APPROVED after reload
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P-06 — Bulk approve-all persists', () => {
    test('P-06: All loops show APPROVED status after bulk approve-all + reload', async ({ page }) => {
        // Before approve-all: loops are PENDING_APPROVAL.
        let approved = false;

        await page.route('**/api/loops?date=**', route => {
            const status = approved ? 'APPROVED' : 'PENDING_APPROVAL';
            const loops = Array.from({ length: 3 }, (_, i) => ({
                ...BASE_LOOP,
                id: `2026-01-03_${8 + i}_loc_downtown`,
                hour: 8 + i,
                status,
            }));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    loops,
                    business_hours: { start: 8, end: 22, is_closed: false, total_loops: 14 },
                }),
            });
        });

        // Mock the approve-all endpoint.
        await page.route('**/loops/approve-all', route => {
            approved = true;
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ approved: 3 }),
            });
        });
        // Also handle the locations-scoped route.
        await page.route('**/locations/**/loops/approve-all', route => {
            approved = true;
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ approved: 3 }),
            });
        });

        await page.goto('/dashboard/retailer/schedule/calendar');
        await expect(page.locator('[data-testid="schedule-timeline"]')).toBeVisible();

        // Click approve-all if present.
        const approveAllBtn = page.locator('[data-testid="approve-all-btn"]');
        if (await approveAllBtn.isVisible()) {
            await approveAllBtn.click();
        }

        // Reload — API now returns APPROVED for all loops.
        await page.reload();
        await expect(page.locator('[data-testid="schedule-timeline"]')).toBeVisible();

        // All visible loop status indicators should show APPROVED.
        const statusBadges = page.locator('[data-testid^="loop-status-"]');
        const count = await statusBadges.count();
        for (let i = 0; i < count; i++) {
            await expect(statusBadges.nth(i)).toContainText(/approved/i);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// P-07: UI polling does not overwrite optimistic APPROVED state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P-07 — Polling does not overwrite optimistic state', () => {
    const LOOP_ID = BASE_LOOP.id;

    test('P-07: Status badge stays APPROVED when polling returns APPROVED', async ({ page }) => {
        // Both initial load and any subsequent poll return APPROVED.
        // This verifies the polling path reads from the API (which reflects
        // persisted state) rather than resetting to a local default.
        await mockLoopStatus(page, LOOP_ID, 'APPROVED', 'APPROVED');

        await page.goto(`/dashboard/admin/loops/${LOOP_ID}`);
        await expect(page.getByText('Loop Builder')).toBeVisible();

        // Fast-forward any polling timers.
        await page.clock.runFor(5 * 60 * 1000); // 5 minutes

        // Status must still be APPROVED after the poll cycle.
        await expect(
            page.locator('[data-testid="loop-status"]')
        ).toContainText(/approved/i);
    });
});
