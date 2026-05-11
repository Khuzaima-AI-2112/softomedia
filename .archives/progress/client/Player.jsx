import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_URL } from '../config.js'

function Player() {
    const [searchParams] = useSearchParams()
    const [screenId, setScreenId] = useState(null)
    const [status, setStatus] = useState('initializing')
    const [screenData, setScreenData] = useState(null) // This state is no longer used in the final render, but kept for consistency with the original code's declaration.
    const [playlist, setPlaylist] = useState([])
    const [currentAdIndex, setCurrentAdIndex] = useState(0)

    useEffect(() => {
        const id = searchParams.get('screen_id') || 'demo-screen-01' // Default to demo-screen-01 if missing
        setScreenId(id)

        // API_URL is imported from config.js

        const fetchPlaylist = async (screenId) => {
            try {
                const res = await fetch(`${API_URL}/api/playlist/${screenId}`);
                const data = await res.json();
                if (data.playlist && data.playlist.length > 0) {
                    setPlaylist(data.playlist);
                    setCurrentAdIndex(0);
                    setStatus('playing');
                } else {
                    setStatus('no_content');
                }
            } catch (e) {
                console.error('Playlist fetch failed', e);
                setStatus('error'); // Or handle specific error states
            }
        };

        const registerScreen = async () => {
            try {
                setStatus('registering');
                const res = await fetch(`${API_URL}/api/screens/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        screen_id: id,
                        resolution: `${window.innerWidth}x${window.innerHeight}`,
                        user_agent: navigator.userAgent
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    setScreenData(data.data); // This line is kept but screenData is not used in the final render
                    setStatus('loading_playlist');
                    fetchPlaylist(id);
                } else {
                    console.error('Registration failed', data);
                    setStatus('error');
                }
            } catch (e) {
                console.error('Network error', e);
                setStatus('offline');
            }
        };

        if (id) {
            registerScreen();
        }
    }, [searchParams])

    // Playback Loop
    useEffect(() => {
        if (status !== 'playing' || !playlist || playlist.length === 0) return;

        const currentAd = playlist[currentAdIndex];
        const duration = (currentAd.duration || 10) * 1000;

        // Record Impression
        const recordImpression = async (ad) => {
            try {
                await fetch(`${API_URL}/api/screens/${screenId}/impressions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ad_id: ad.id,
                        timestamp: new Date().toISOString(),
                        duration: ad.duration
                    })
                });
                console.log(`Recorded impression for ${ad.title}`);
            } catch (e) {
                console.error('Failed to record impression', e);
            }
        };

        recordImpression(currentAd);

        const timer = setTimeout(() => {
            setCurrentAdIndex((prev) => (prev + 1) % playlist.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [status, playlist, currentAdIndex, screenId]);

    // Current Ad Render
    const activeAd = playlist ? playlist[currentAdIndex] : null;

    if (status === 'playing' && activeAd) {
        return (
            <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black', overflow: 'hidden' }}>
                <img
                    src={activeAd.url}
                    alt={activeAd.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Debug overlay */}
                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 5, fontSize: 10 }}>
                    {activeAd.title} | {activeAd.duration}s
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            fontFamily: 'sans-serif'
        }}>
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', margin: 0 }}>SoftoMedia Player</h1>

                <div style={{ margin: '2rem 0' }}>
                    {status === 'registering' && <span style={{ color: '#fbbf24' }}>Connecting...</span>}
                    {status === 'loading_playlist' && <span style={{ color: '#60a5fa' }}>Loading Content...</span>}
                    {status === 'no_content' && <span style={{ color: '#9ca3af' }}>No ads scheduled.</span>}
                    {status === 'offline' && <span style={{ color: '#ef4444' }}>● Offline</span>}
                    {status === 'error' && <span style={{ color: '#ef4444' }}>Error occurred.</span>}
                </div>

                <div style={{
                    padding: '1rem',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    display: 'inline-block',
                    backgroundColor: '#111'
                }}>
                    <p style={{ color: '#888', margin: 0 }}>Screen ID</p>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{screenId}</p>
                </div>
            </div>
        </div>
    )
}

export default Player
