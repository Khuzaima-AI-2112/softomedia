async function verify() {
    const BASE_URL = 'http://localhost:8080';
    const SCREEN_ID = 'api-verify-screen';

    try {
        console.log('1. Logging in...');
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@softomedia.com' })
        });
        const { token } = await loginRes.json();
        console.log('   Token acquired.');

        console.log('2. Registering Screen...');
        await fetch(`${BASE_URL}/api/screens/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ screen_id: SCREEN_ID, resolution: '1920x1080' })
        });
        console.log('   Screen registered.');

        console.log('3. Creating Playlist...');
        const playlistData = {
            name: "API Verification Playlist",
            status: "ACTIVE",
            assignments: [SCREEN_ID],
            items: [
                { media_id: "demo-asset-1", duration: 15, order: 1 }
            ]
        };
        const createRes = await fetch(`${BASE_URL}/api/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(playlistData)
        });
        const playlist = await createRes.json();
        console.log(`   Playlist created: ${playlist.id}`);

        console.log('4. Fetching Player Playlist...');
        const playerRes = await fetch(`${BASE_URL}/api/playlist/${SCREEN_ID}`);
        const playerData = await playerRes.json();

        console.log('--------------------------------------------------');
        console.log('PLAYER RESPONSE:', JSON.stringify(playerData, null, 2));
        console.log('--------------------------------------------------');

        if (playerData.source === 'playlist' && playerData.playlist_name === playlistData.name) {
            console.log('✅ VERIFICATION SUCCESS: Player is serving the assigned playlist.');
        } else {
            console.error('❌ VERIFICATION FAILURE: Player is serving:', playerData.source);
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ ERROR:', e);
        process.exit(1);
    }
}

verify();
