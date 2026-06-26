import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Media Lifecycle & Cloud Storage Verification', () => {

    test.beforeEach(async ({ adminPage: page }) => {
        // Fix #3: Ensure Date/Time Mock Applies Early
        await page.addInitScript(() => {
            // Freeze time at 10:00 AM on 2026-01-02
            const mockDateTime = new Date('2026-01-02T10:00:00');
            const OriginalDate = window.Date;

            window.Date = class extends OriginalDate {
                constructor(...args) {
                    if (args.length === 0) return new OriginalDate(mockDateTime.getTime());
                    return new OriginalDate(...args);
                }
                static now() { return mockDateTime.getTime(); }
            };
            // Preserve static methods and prototype
            Object.setPrototypeOf(window.Date, OriginalDate);
            window.Date.prototype = OriginalDate.prototype;

            console.log('[Test] Mock time active: 2026-01-02 10:00:00');
        });

        // Fix #1: Add Missing Registration Mock
        await page.route('**/api/screens/register', async route => {
            console.log('[MOCK] Intercepted /api/screens/register');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify( Object.assign({},  {
                    screenId: 'test-screen-123',
                    status: 'registered'
                } ) )
            });
        });

        // Fix #4: Comprehensive Logging
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Player]') || text.includes('[Render]') || text.includes('✅') || text.includes('❌')) {
                console.log(` >> BROWSER: ${text}`);
            }
        });
    });

    test('should upload an asset and verify it is served via cloud-compatible URL', async ({ request }) => {
        // 1. Create a dummy image file for upload
        const testFilePath = path.join(process.cwd(), 'tests', 'test-ad.png');
        if (!fs.existsSync(testFilePath)) {
            fs.writeFileSync(testFilePath, 'dummy-image-content');
        }

        const fileBuffer = fs.readFileSync(testFilePath);

        // 2. Upload the file via API
        const response = await request.post('http://localhost:8080/api/assets/upload', {
            multipart: {
                file: {
                    name: 'test-ad.png',
                    mimeType: 'image/png',
                    buffer: fileBuffer,
                },
                duration: '5',
                file_type: 'image/png'
            }
        });

        expect(response.status()).toBe(201);
        const asset = await response.json();

        // 3. Verify asset properties
        expect(asset.id).toContain('ast_');
        expect(asset.url).toBeDefined();

        // If GOOGLE_APPLICATION_CREDENTIALS is missing, it falls back to localhost:8080/assets/ filename
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            expect(asset.url).toContain('storage.googleapis.com');
            expect(asset.storage_path).toContain('gs://');
        } else {
            console.log('⚠️ Verified local fallback URL (no backslashes):', asset.url);
            expect(asset.url).toContain('http://localhost:8080/assets/');
            expect(asset.url).not.toContain('\\');
        }

        // 4. Verify asset is accessible
        const assetResponse = await request.get(asset.url);
        expect(assetResponse.status()).toBe(200);
    });

    test('Player transitions from splash to playing state', async ({ adminPage: page }) => {
        const mockAsset = {
            id: 'ast_mock_123',
            url: 'https://storage.googleapis.com/softomedia-live-2026-assets/test-ad.png',
            duration: 5,
            file_type: 'image/png'
        };

        // Mock the loop API
        await page.route('**/api/loops?date=2026-01-02', async route => {
            console.log('[MOCK] Intercepted /api/loops');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify( Object.assign({},  {
                    loops: [{
                        id: 'loop_now',
                        hour: 10,
                        status: 'APPROVED',
                        slots: [{
                            position: 0,
                            asset_id: mockAsset.id,
                            duration: 5,
                            url: mockAsset.url
                        }]
                    }]
                } ) )
            });
        });

        // Navigate to player
        await page.goto('http://localhost:5173/player?screen_id=test_screen&debug=true');

        // Fix #5: Add Granular Test Assertions

        // 1. Check for registration state
        const root = page.locator('[data-testid="player-root"]');
        await expect(root).toBeVisible();

        // 2. Wait for transition to playing
        await expect(root).toHaveAttribute('data-status', 'playing', { timeout: 15000 });
        console.log('✅ Status transitioned to playing');

        // 3. Verify ad image is visible
        const adImage = page.locator('[data-testid="ad-image"]');
        await expect(adImage).toBeVisible();
        const src = await adImage.getAttribute('src');
        expect(src).toBe(mockAsset.url);
        console.log('✅ Ad image visible with correct source');

        // 4. Verify splash screen (h1) is gone
        const splash = page.locator('h1:has-text("SoftoMedia Player")');
        await expect(splash).not.toBeVisible();
        console.log('✅ Splash screen removed');
    });
});
