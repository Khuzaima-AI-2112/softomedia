/**
 * Phase 16 — Login Page as a Tested Feature
 * Persona: Unauthenticated
 *
 * FIX [Minor Issue 13]: Step 16.5 asserts redirect to /login (unauthenticated root),
 * NOT /dashboard/admin — that is the post-login destination for an admin user.
 *
 * This phase runs last in the wizard sequence before globalTeardown.
 * No auth setup needed — all steps begin unauthenticated.
 */

import { test, expect } from '@playwright/test';
import { authReset, BASE_URL } from './demo.fixtures.js';

test.beforeEach(authReset);

test.describe.serial('Phase 16 — Login Feature', () => {

  test('16.1 — Navigate to /login unauthenticated; form renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"], input[name="email"], [data-testid="input-email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"], [data-testid="input-password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], [data-testid="btn-login"]').first()).toBeVisible();
  });

  test('16.2 — Submit empty form: client-side validation fires; no API call', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    let apiCallMade = false;
    await page.route('**/api/auth/login', () => { apiCallMade = true; });

    await page.locator('button[type="submit"], [data-testid="btn-login"]').first().click();

    // Validation must fire
    await expect(
      page.locator('[data-testid="field-error"], .field-error, [aria-invalid="true"]').first()
    ).toBeVisible();
    // No API call must have been made
    expect(apiCallMade).toBe(false);
  });

  test('16.3 — Submit wrong credentials: POST /api/auth/login → 401; error banner shown', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.locator('input[type="email"], input[name="email"], [data-testid="input-email"]').first().fill('wrong@example.com');
    await page.locator('input[type="password"], input[name="password"], [data-testid="input-password"]').first().fill('wrongpassword');

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST'
      ),
      page.locator('button[type="submit"], [data-testid="btn-login"]').first().click(),
    ]);

    expect(loginResponse.status()).toBe(401);
    // Error banner must appear — not clear the form
    await expect(
      page.locator('[data-testid="login-error"], [data-testid="error-banner"], .error-message').first()
    ).toBeVisible();
    // Form fields must still contain the entered values (not cleared on error)
    const emailValue = await page.locator('input[type="email"], input[name="email"]').first().inputValue();
    expect(emailValue).toBe('wrong@example.com');
  });

  test('16.4 — Login with valid demo credentials → redirect to /dashboard within 2s', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.locator('input[type="email"], input[name="email"], [data-testid="input-email"]').first().fill('admin@demo.softomedia.com');
    await page.locator('input[type="password"], input[name="password"], [data-testid="input-password"]').first().fill('demo-password');

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST'
      ),
      page.locator('button[type="submit"], [data-testid="btn-login"]').first().click(),
    ]);

    expect(loginResponse.status()).toBe(200);
    // Redirect to dashboard within 2s
    await page.waitForURL(/\/dashboard/, { timeout: 2000 });
    await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible();
  });

  test('16.5 — Root / unauthenticated redirects to /login (not /dashboard/admin)', async ({ page }) => {
    // Start with no auth state (authReset in beforeEach handles this)
    await page.goto(`${BASE_URL}/`);
    // Must redirect to /login — not 404, not /dashboard/admin
    await page.waitForURL(/\/login/, { timeout: 3000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

});
