import { test, expect } from '@playwright/test';

/**
 * Global Playlist Telemetry Tests (TDD - Batch Architecture)
 * Verifies that impressions are tagged with the correct source (global vs assigned)
 * and stored in the local telemetry buffer as per the "No Chatty API" decision.
 */
test.describe('Global Playlist Telemetry', () => {
    const API_BASE = 'http://localhost:8080';
    const PLAYER_URL = 'http://localhost:5173/player';

    test.describe('1. Batch Metadata Capture', () => {
        let globalPlaylistId;

        // Mock the protected registration endpoint to unblock player initialization
        test.beforeEach(async ({ page }) => {
            await page.route('**/api/screens/register', route => {
                route.fulfill({
                    status: 200,
                    json: { status: 'ok', screen_id: 'mocked' }
                });
            });
        });

        test.beforeAll(async ({ request }) => {
            // Create a global playlist
            // Note: We bypass auth for creation in tests if the API allows it, 
            // otherwise we'd need to log in first.
            const res = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'Telemetry Test Global',
                    status: 'active',
                    is_global: true,
                    items: [{ media_id: 'demo-asset-1', duration: 5, order: 1 }]
                }
            });
            const data = await res.json();
            console.log('CREATE RES:', data);
            globalPlaylistId = data.id;
            console.log('Created Global Playlist:', globalPlaylistId);

            // DEBUG: Verify it exists and is public
            const check = await request.get(`${API_BASE}/api/playlists/${globalPlaylistId}`);
            console.log('Verified Playlist State:', await check.json());
        });

        test('Debug: Check all active playlists', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/playlists`);
            const data = await res.json();
            console.log('All Playlists in Server:', data.map(p => ({ id: p.id, global: p.is_global, status: p.status })));
        });

        test('Verify API response for global fallback', async ({ request }) => {
            const screenId = `verify-api-${Date.now()}`;
            const res = await request.get(`${API_BASE}/api/playlist/${screenId}`);
            console.log('API Status:', res.status());
            const data = await res.json();
            console.log('API Response Body:', data);
            expect(data.source).toBe('global_playlist');
            expect(data.playlist_id).toBe(globalPlaylistId);
        });

        test('Player identifies and batches global playlist source into localStorage', async ({ page }) => {
            // Use a unique screen ID to avoid caching interference from other tests
            const screenId = `tele-screen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            // Navigate to player with debug mode
            await page.goto(`${PLAYER_URL}?screen_id=${screenId}&debug=true`);

            // Wait for player to start playing (shows ad-frame)
            // Increased timeout for slow initialization
            await expect(page.locator('[data-testid="ad-frame"]')).toBeVisible({ timeout: 15000 });

            // Check localStorage buffer (Batch Architecture)
            const buffer = await page.evaluate(() => {
                const data = localStorage.getItem('softomedia_impression_buffer');
                return data ? JSON.parse(data) : [];
            });

            console.log('Telemetry Buffer:', buffer);

            expect(buffer.length).toBeGreaterThan(0);

            // Find an impression for our media
            const impression = buffer.find(i => i.mediaId === 'demo-asset-1' || i.campaignId === globalPlaylistId);
            expect(impression).toBeDefined();

            // VERIFICATION: The source must be 'global_playlist'
            expect(impression.source).toBe('global_playlist');
            expect(impression.playlistId).toBe(globalPlaylistId);
        });

        test('Player correctly batches assigned playlist source', async ({ request, page }) => {
            const screenId = `assigned-screen-${Date.now()}`;

            // 1. Create an assigned playlist
            const res = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'Assigned Telemetry Test',
                    status: 'active',
                    is_global: false,
                    assignments: [screenId],
                    items: [{ media_id: 'demo-asset-2', duration: 5, order: 1 }]
                }
            });
            const playlistId = (await res.json()).id;

            // 2. Play
            await page.goto(`${PLAYER_URL}?screen_id=${screenId}&debug=true`);
            await expect(page.locator('[data-testid="ad-frame"]')).toBeVisible();

            // 3. Verify buffer
            const buffer = await page.evaluate(() => {
                const data = localStorage.getItem('softomedia_impression_buffer');
                return data ? JSON.parse(data) : [];
            });

            const impression = buffer.find(i => i.mediaId === 'demo-asset-2');
            expect(impression).toBeDefined();
            expect(impression.source).toBe('playlist'); // Assigned source
            expect(impression.playlistId).toBe(playlistId);

            // Cleanup
            await request.delete(`${API_BASE}/api/playlists/${playlistId}`);
        });

        test.afterAll(async ({ request }) => {
            if (globalPlaylistId) {
                await request.delete(`${API_BASE}/api/playlists/${globalPlaylistId}`);
            }
        });
    });
});
