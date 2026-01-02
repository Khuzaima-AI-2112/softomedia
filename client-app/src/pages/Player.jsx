import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_URL } from '../config.js'
import { telemetryService } from '../services/TelemetryService.js'

function Player() {
    const [searchParams] = useSearchParams()
    const [screenId, setScreenId] = useState(null)
    const [status, setStatus] = useState('initializing')
    const [screenData, setScreenData] = useState(null) // This state is no longer used in the final render, but kept for consistency with the original code's declaration.
    const [playlist, setPlaylist] = useState([])
    const [playlistMeta, setPlaylistMeta] = useState({ source: 'unknown', id: null })
    const [currentAdIndex, setCurrentAdIndex] = useState(0)

    // Playlist Polling (Every 60 seconds)
    useEffect(() => {
        if (!screenId) return;

        const fetchPlaylist = async (id) => {
            try {
                const res = await fetch(`${API_URL}/api/playlist/${id}`);
                const data = await res.json();
                if (data.playlist && data.playlist.length > 0) {
                    setPlaylist(data.playlist);
                    setPlaylistMeta({ source: data.source || 'assigned', id: data.playlist_id || data.id });
                    // Don't reset currentAdIndex to avoid visual jumps on refresh
                    if (status !== 'playing') setStatus('playing');
                } else if (status !== 'no_content') {
                    setStatus('no_content');
                }
            } catch (e) {
                console.error('Playlist poll failed', e);
            }
        };

        const pollInterval = setInterval(() => {
            fetchPlaylist(screenId);
        }, 60000); // 60s background refresh

        return () => clearInterval(pollInterval);
    }, [screenId, status]);

    useEffect(() => {
        const id = searchParams.get('screen_id') || 'demo-screen-01'
        setScreenId(id)

        const fetchPlaylist = async (screenId) => {
            try {
                const res = await fetch(`${API_URL}/api/playlist/${screenId}`);
                const data = await res.json();
                if (data.playlist && data.playlist.length > 0) {
                    setPlaylist(data.playlist);
                    setPlaylistMeta({ source: data.source || 'assigned', id: data.playlist_id || data.id });
                    setCurrentAdIndex(0);
                    setStatus('playing');
                } else {
                    setStatus('no_content');
                }
            } catch (e) {
                console.error('Initial playlist fetch failed', e);
                setStatus('error');
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

                if (res.ok) {
                    setStatus('loading_playlist');
                    fetchPlaylist(id);
                } else {
                    setStatus('error');
                }
            } catch (e) {
                setStatus('offline');
            }
        };

        if (id) {
            registerScreen();
        }
    }, [searchParams])

    // --- SRE: White-Box Observability & Transport ---
    const logTelemetryEvent = (type, payload) => {
        // Enable logging if in Test Mode OR if URL has ?debug=true
        const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';

        if (import.meta.env.MODE === 'test' || isDebug || window.__FORCE_TEST_LOGGING__) {
            if (!window.__TELEMETRY_LOG__) window.__TELEMETRY_LOG__ = [];
            window.__TELEMETRY_LOG__.push({ type, timestamp: Date.now(), payload });
            // Keep buffer small (Circular Buffer Pattern)
            if (window.__TELEMETRY_LOG__.length > 50) window.__TELEMETRY_LOG__.shift();
        }
    };

    const sendTelemetry = (endpoint, data) => {
        const url = `${API_URL}${endpoint}`;

        // Log intent (Synchronous, Deterministic)
        logTelemetryEvent(endpoint.includes('heartbeat') ? 'HEARTBEAT' : 'IMPRESSION', data);

        // Send via Beacon (Reliable Transport)
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            // Fallback for older browsers
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                keepalive: true
            }).catch(e => console.error('Telemetry fallback failed', e));
        }
    };

    // Heartbeat (Every 30 seconds)
    useEffect(() => {
        if (!screenId) return;

        const sendHeartbeat = () => {
            sendTelemetry('/api/monitoring/heartbeat', { screenId });
        };

        sendHeartbeat();
        const interval = setInterval(sendHeartbeat, 30000);
        return () => clearInterval(interval);
    }, [screenId]);

    // Playback Loop
    useEffect(() => {
        if (status !== 'playing' || !playlist || playlist.length === 0) return;

        const currentAd = playlist[currentAdIndex];
        const duration = (currentAd.duration || 5) * 1000;

        const recordImpression = (ad) => {
            // Batch Audit Trail (High Reliability)
            telemetryService.trackImpression({
                screenId,
                campaignId: ad.campaign_id || ad.id,
                mediaId: ad.media_id || ad.id,
                duration: ad.duration,
                source: playlistMeta.source,
                playlistId: playlistMeta.id
            });

            // Note: We removed the direct 'sendTelemetry' call for impressions 
            // to avoid "Chatty API" per architectural decision 2026-01-02.
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
                    data-testid="ad-image"
                    src={activeAd.url}
                    alt={activeAd.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Debug overlay */}
                <div
                    data-testid="ad-debug-overlay"
                    style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 5, fontSize: 10 }}
                >
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
