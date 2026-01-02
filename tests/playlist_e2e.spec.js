import { test, expect } from '@playwright/test';

/**
 * Unified Playlist E2E Tests
 * Tests the full lifecycle of Global and Assigned playlists including:
 * - Creation, assignment, and fallback behavior
 * - Telemetry tagging for both types
 */
test.describe('Playlist Lifecycle E2E', () => {
    const API_BASE = 'http://localhost:8080';
    const PLAYER_URL = 'http://localhost:5173/player';

    // Mock registration for all player tests
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/screens/register', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ok', screen_id: 'mocked' })
            });
        });
    });

    test.describe('Fallback Priority', () => {
        let globalId;
        let assignedId;
        const screenId = `priority-screen-${Date.now()}`;

        test.beforeAll(async ({ request }) => {
            // Create Global Playlist
            const globalRes = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'E2E Global Fallback',
                    status: 'ACTIVE',
                    is_global: true,
                    items: [{ media_id: 'global-asset', duration: 5, order: 1 }]
                }
            });
            globalId = (await globalRes.json()).id;

            // Create Assigned Playlist for specific screen
            const assignedRes = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'E2E Assigned Playlist',
                    status: 'ACTIVE',
                    is_global: false,
                    assignments: [screenId],
                    items: [{ media_id: 'assigned-asset', duration: 10, order: 1 }]
                }
            });
            assignedId = (await assignedRes.json()).id;
        });

        test('Assigned playlist takes priority over global', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/playlist/${screenId}`);
            const data = await res.json();

            expect(data.source).toBe('playlist'); // Assigned
            expect(data.playlist_id).toBe(assignedId);
        });

        test('Unassigned screen receives global fallback', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/playlist/random-unassigned-screen`);
            const data = await res.json();

            expect(data.source).toBe('global_playlist');
            expect(data.playlist_id).toBe(globalId);
        });

        test('Deleting assigned playlist triggers global fallback', async ({ request }) => {
            // Delete the assigned playlist
            await request.delete(`${API_BASE}/api/playlists/${assignedId}`);

            // Now the screen should receive global
            const res = await request.get(`${API_BASE}/api/playlist/${screenId}`);
            const data = await res.json();

            expect(data.source).toBe('global_playlist');
            expect(data.playlist_id).toBe(globalId);

            // Mark as cleaned up
            assignedId = null;
        });

        test.afterAll(async ({ request }) => {
            if (globalId) await request.delete(`${API_BASE}/api/playlists/${globalId}`);
            if (assignedId) await request.delete(`${API_BASE}/api/playlists/${assignedId}`);
        });
    });

    test.describe('Telemetry Tagging', () => {
        test('Global playlist impressions tagged correctly in batch buffer', async ({ request, page }) => {
            const playlistRes = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'Telemetry Global',
                    status: 'ACTIVE',
                    is_global: true,
                    items: [{ media_id: 'tele-asset', duration: 5, order: 1 }]
                }
            });
            const playlistId = (await playlistRes.json()).id;

            await page.goto(`${PLAYER_URL}?screen_id=telemetry-test-${Date.now()}&debug=true`);
            await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 15000 });

            const buffer = await page.evaluate(() => {
                const data = localStorage.getItem('softomedia_impression_buffer');
                return data ? JSON.parse(data) : [];
            });

            expect(buffer.length).toBeGreaterThan(0);
            const impression = buffer.find(i => i.playlistId === playlistId);
            expect(impression?.source).toBe('global_playlist');

            await request.delete(`${API_BASE}/api/playlists/${playlistId}`);
        });
    });
});
