import { test, expect, hasEmulators, signIn, signOut } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Retailer Administrator reports a Support Ticket that the Technical Operator updates, without AI surfaces', async ({ page, demo }) => {
    const subject = `Checkout screen offline ${Date.now()}`;
    const note = 'Technician is restarting the checkout player.';
    await demo.reset();
    await demo.provisionPersonas();

    try {
        const ticketCard = page.getByRole('link', { name: new RegExp(subject) });

        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.getByTestId('nav-tickets').click();
        await page.getByTestId('btn-create-ticket').click();
        await page.getByLabel('Subject').fill(subject);
        await page.getByLabel('Category').selectOption('network');
        await page.getByLabel('Description').fill('The checkout screen shows a disconnected icon.');
        await page.getByRole('button', { name: 'Submit ticket' }).click();
        await expect(page.getByRole('status')).toHaveText('Support Ticket submitted.');
        await expect(ticketCard).toContainText('Open');
        await page.reload();
        await expect(ticketCard).toContainText('Open');
        await signOut(page);

        await signIn(page, 'techoperator@demo.softomedia.test', /\/dashboard\/techoperator$/);
        await page.getByTestId('nav-tickets').click();
        await ticketCard.click();
        await expect(page.getByRole('heading', { name: subject })).toBeVisible();
        await page.getByLabel('Status').selectOption('in_progress');
        await page.getByLabel('Note').fill(note);
        await page.getByRole('button', { name: 'Save update' }).click();
        await expect(page.getByTestId('ticket-status')).toHaveText('In progress');
        await expect(page.getByText(note)).toBeVisible();
        await page.reload();
        await expect(page.getByTestId('ticket-status')).toHaveText('In progress');
        await expect(page.getByText(note)).toBeVisible();
        await signOut(page);

        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.getByTestId('nav-tickets').click();
        await expect(ticketCard).toContainText('In progress');
        await ticketCard.click();
        await expect(page.getByText(note)).toBeVisible();
        await expect(page.getByLabel('Status')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Save update' })).toHaveCount(0);
        await signOut(page);

        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await expect(page.getByTestId('nav-tickets')).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'AI Log' })).toHaveCount(0);
        await page.goto('/dashboard/tickets');
        await expect(page.getByRole('alert')).toHaveText('Access denied');
        await expect(page.getByText(subject)).toHaveCount(0);
        await page.goto('/dashboard/admin/ai-log');
        await expect(page.getByTestId('error-404')).toBeVisible();
    } finally {
        await demo.reset();
    }
});
