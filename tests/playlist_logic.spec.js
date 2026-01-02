import { test, expect } from '@playwright/test';

/**
 * Playlist Orchestration Integration Test
 * Verifies the "Create -> Assign -> Serve" loop via API.
 * This avoids visual/rendering flakiness by focusing on the logic contract.
 */
test.describe('Playlist Orchestration API', () => {
    let authToken;
    const testScreenId = 'e2e-playlist-screen';

    test.beforeAll(async ({ request }) => {
        // 1. Authenticate as Admin
        const loginRes = await request.post('http://localhost:8080/api/auth/login', {
            data: { email: 'admin@softomedia.com' }
        });
        expect(loginRes.ok()).toBeTruthy();
        authToken = (await loginRes.json()).token;

        // 2. Register a Test Screen
        await request.post('http://localhost:8080/api/screens/register', {
            headers: { 'Authorization': `Bearer ${authToken}` },
            data: { screen_id: testScreenId, resolution: '1920x1080' }
        });
    });

    test('End-to-End Playlist Assignment Loop', async ({ request }) => {
        // A. Verify Baseline: Logic should return "Default/Random" or "Empty" initially
        const initialRes = await request.get(`http://localhost:8080/api/playlist/${testScreenId}`);
        const initialData = await initialRes.json();
        // Should NOT be source: 'playlist' yet, or if it is, it's not our specific one
        if (initialData.source === 'playlist') {
            console.log('Note: System already has a playlist or fell back to one.');
        }

        // B. Create a new "Summer Sale" Playlist via Admin API
        const payload = {
            name: "E2E Summer Sale",
            description: "Integration Test Playlist",
            status: "ACTIVE",
            assignments: [testScreenId], // Explicit assignment
            items: [
                { media_id: "demo-asset-1", duration: 15, order: 1 },
                { media_id: "demo-asset-2", duration: 10, order: 2 }
            ]
        };

        const createRes = await request.post('http://localhost:8080/api/playlists', {
            headers: { 'Authorization': `Bearer ${authToken}` },
            data: payload
        });
        expect(createRes.ok()).toBeTruthy();
        const playlistId = (await createRes.json()).id;
        console.log(`Created Playlist: ${playlistId}`);

        // C. Verify Player API "Serves" this new playlist
        // The service should prioritize the Explicit assignment we just made
        const serveRes = await request.get(`http://localhost:8080/api/playlist/${testScreenId}`);
        expect(serveRes.ok()).toBeTruthy();
        const serveData = await serveRes.json();
        console.log('DEBUG: serveData', JSON.stringify(serveData, null, 2));

        // ASSERTIONS
        expect(serveData.source).toBe('playlist');
        expect(serveData.playlist_name).toBe("E2E Summer Sale");
        expect(serveData.playlist.length).toBe(2);
        expect(serveData.playlist[0].duration).toBe(15);
        expect(serveData.playlist[0].campaign_id).toBe(playlistId);

        // D. Cleanup (Delete the playlist)
        await request.delete(`http://localhost:8080/api/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    });
});
