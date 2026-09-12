import { test, expect } from '@playwright/test';

/**
 * Global Playlist API Tests (TDD)
 * These tests define the expected behavior BEFORE implementation.
 * Run with: npx playwright test tests/global_playlist.spec.js
 */
test.describe('Global Playlist Feature', () => {
    const API_BASE = 'http://localhost:8080';

    test.describe('1. API: Create Global Playlist', () => {
        let globalPlaylistId;

        test('Can create a playlist with is_global=true', async ({ request }) => {
            const res = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'TDD Global Test Playlist',
                    description: 'Created via TDD test',
                    status: 'active',
                    is_global: true,
                    items: [
                        { media_id: 'demo-asset-1', duration: 10, order: 1 },
                        { media_id: 'demo-asset-2', duration: 10, order: 2 }
                    ]
                }
            });
            expect(res.ok()).toBeTruthy();
            const data = await res.json();
            expect(data.is_global).toBe(true);
            globalPlaylistId = data.id;
        });

        test.afterAll(async ({ request }) => {
            // Cleanup
            if (globalPlaylistId) {
                await request.delete(`${API_BASE}/api/playlists/${globalPlaylistId}`);
            }
        });
    });

    test.describe('2. Service: Unassigned Screen Receives Global Playlist', () => {
        let globalPlaylistId;

        test.beforeAll(async ({ request }) => {
            // Create a global playlist for this test suite
            const res = await request.post(`${API_BASE}/api/playlists`, {
                data: {
                    name: 'Global Fallback Test',
                    status: 'active',
                    is_global: true,
                    items: [{ media_id: 'demo-asset-1', duration: 10, order: 1 }]
                }
            });
            globalPlaylistId = (await res.json()).id;
        });

        test('Screen with no specific assignment receives global playlist', async ({ request }) => {
            const orphanScreenId = `orphan-${Date.now()}`;
            const res = await request.get(`${API_BASE}/api/playlist/${orphanScreenId}`);
            expect(res.ok()).toBeTruthy();
            const data = await res.json();

            // Should return the global playlist as fallback
            expect(data.source).toBe('global_playlist');
            expect(data.playlist_name).toBe('Global Fallback Test');
        });

        test('Global playlist items have forced 5s duration', async ({ request }) => {
            const orphanScreenId = `orphan-5s-${Date.now()}`;
            const res = await request.get(`${API_BASE}/api/playlist/${orphanScreenId}`);
            const data = await res.json();

            // Even though we created with 10s, service should force 5s
            expect(data.playlist[0].duration).toBe(5);
        });

        test.afterAll(async ({ request }) => {
            if (globalPlaylistId) {
                await request.delete(`${API_BASE}/api/playlists/${globalPlaylistId}`);
            }
        });
    });

});
