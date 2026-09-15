import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

// The exact five-loop 42/12/6 window is proven at the HTTP seam
// (ad-server/tests/allocation-window.integration.test.js). This journey proves
// the Admin generates through the UI and the report matches what was persisted.
test('Admin generates Allocation Windows and the report matches the persisted loops after reload', async ({ page, demo }) => {
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    await demo.reset();
    await demo.provisionPersonas();

    try {
        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await page.goto('/dashboard/admin/loops');
        // The page generates for tomorrow as the browser computes it.
        const targetDate = await page.evaluate(() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        });
        await page.getByTestId('generate-loops-btn').click();
        await expect(page.getByText(`Loops generated for ${targetDate} across all stores.`)).toBeVisible();

        const persisted = await loopRepository.findAll({ where: [['date', '==', targetDate]] });
        const storeLoops = persisted.filter(loop => loop.store_id === 'demo-store-mtl-north');
        // Default Store hours are 08:00–22:00: one twelve-slot loop per hour.
        expect(storeLoops.map(loop => loop.hour).sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
        expect(storeLoops.every(loop => loop.slots.length === 12)).toBe(true);

        const slots = persisted.flatMap(loop => loop.slots);
        const count = predicate => String(slots.filter(predicate).length);
        const expected = {
            Paid: count(slot => slot.allocated_category === 'paid'),
            Retailer: count(slot => slot.allocated_category === 'retailer'),
            Internal: count(slot => slot.allocated_category === 'internal'),
            'Campaign content': count(slot => slot.content_kind === 'campaign'),
            'Media content': count(slot => slot.content_kind === 'media'),
            'Fallback content': count(slot => slot.content_kind === 'fallback'),
        };
        expect(Number(expected.Paid) + Number(expected.Retailer) + Number(expected.Internal)).toBe(slots.length);

        for (const view of ['generated', 'reloaded']) {
            if (view === 'reloaded') await page.reload();
            const summary = page.getByTestId('allocation-summary');
            for (const [label, value] of Object.entries(expected)) {
                await expect(summary.getByText(label, { exact: true }).locator('..')).toHaveText(`${label}${value}`);
            }
            await expect(page.getByTestId('loop-hour-21')).toBeVisible();
            await expect(page.getByTestId('loop-hour-22')).toHaveCount(0);
        }
    } finally {
        await demo.reset();
    }
});
