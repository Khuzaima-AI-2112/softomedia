import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_URL } from '../config.js'
import { telemetryService } from '../services/TelemetryService.js'

// Business hours configuration for loop playback
const BUSINESS_HOURS = { START: 8, END: 22 };

// Get current hour in business hours context
const getCurrentHour = () => new Date().getHours();

// Check if current time is within business hours
const isBusinessHours = () => {
    const hour = getCurrentHour();
    return hour >= BUSINESS_HOURS.START && hour < BUSINESS_HOURS.END;
};

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => new Date().toISOString().split('T')[0];

function Player() {
    const [searchParams] = useSearchParams()
    const [screenId, setScreenId] = useState(null)
    const [status, setStatus] = useState('initializing')
    const [screenData, setScreenData] = useState(null)

    // Loop-based playback state
    const [playbackMode, setPlaybackMode] = useState('playlist') // 'loop' | 'playlist'
    const [currentLoop, setCurrentLoop] = useState(null)
    const [currentHour, setCurrentHour] = useState(getCurrentHour())

    // Playlist fallback state
    const [playlist, setPlaylist] = useState([])
    const [playlistMeta, setPlaylistMeta] = useState({ source: 'unknown', id: null })
    const [currentAdIndex, setCurrentAdIndex] = useState(0)
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0)

    // Fetch loop for current hour
    const fetchCurrentLoop = useCallback(async (screenId) => {
        if (!isBusinessHours()) {
            console.log('[Player] Outside business hours, using playlist fallback');
            return null;
        }

        try {
            const date = getTodayDate();
            const hour = getCurrentHour();
            const res = await fetch(`${API_URL}/api/loops?date=${date}`);
            const data = await res.json();

            // Find approved loop for current hour
            const loop = (data.loops || []).find(l =>
                l.hour === hour && l.status === 'APPROVED'
            );

            if (loop && loop.slots && loop.slots.length > 0) {
                console.log(`[Player] Found approved loop for ${hour}:00`, loop.id);
                return loop;
            }
        } catch (e) {
            console.error('[Player] Loop fetch failed', e);
        }
        return null;
    }, []);

    // Hour change detection
    useEffect(() => {
        const checkHourChange = () => {
            const newHour = getCurrentHour();
            if (newHour !== currentHour) {
                console.log(`[Player] Hour changed: ${currentHour} → ${newHour}`);
                setCurrentHour(newHour);
                setCurrentSlotIndex(0); // Reset to first slot
            }
        };

        const interval = setInterval(checkHourChange, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, [currentHour]);

    // Fetch loop when hour changes
    useEffect(() => {
        if (!screenId) return;

        const loadLoop = async () => {
            const loop = await fetchCurrentLoop(screenId);
            if (loop) {
                setCurrentLoop(loop);
                setPlaybackMode('loop');
                setStatus('playing');
            } else {
                // Fallback to playlist
                setPlaybackMode('playlist');
            }
        };

        loadLoop();
    }, [screenId, currentHour, fetchCurrentLoop]);

    // Playlist Polling Fallback (Every 60 seconds)
    useEffect(() => {
        if (!screenId || playbackMode === 'loop') return;
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

    // Playback Loop (Playlist Mode)
    useEffect(() => {
        if (status !== 'playing' || playbackMode !== 'playlist' || !playlist || playlist.length === 0) return;

        const currentAd = playlist[currentAdIndex];
        const duration = (currentAd.duration || 5) * 1000;

        const recordImpression = (ad) => {
            telemetryService.trackImpression({
                screenId,
                campaignId: ad.campaign_id || ad.id,
                mediaId: ad.media_id || ad.id,
                duration: ad.duration,
                source: playlistMeta.source,
                playlistId: playlistMeta.id
            });
        };

        recordImpression(currentAd);

        const timer = setTimeout(() => {
            setCurrentAdIndex((prev) => (prev + 1) % playlist.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [status, playbackMode, playlist, currentAdIndex, screenId, playlistMeta]);

    // Loop Slot Playback (Loop Mode - Sprint 4)
    useEffect(() => {
        if (status !== 'playing' || playbackMode !== 'loop' || !currentLoop) return;

        const slots = currentLoop.slots || [];
        if (slots.length === 0) return;

        const currentSlot = slots[currentSlotIndex];
        const duration = (currentSlot?.duration || 5) * 1000;

        // Record proof-of-play telemetry with loop context
        telemetryService.trackImpression({
            screenId,
            campaignId: currentSlot?.campaign_id,
            mediaId: currentSlot?.asset_id,
            duration: currentSlot?.duration || 5,
            source: 'loop',
            playlistId: currentLoop.id,
            // Loop-specific telemetry fields
            loopId: currentLoop.id,
            loopHour: currentLoop.hour,
            slotPosition: currentSlotIndex
        });

        logTelemetryEvent('LOOP_SLOT_PLAY', {
            loopId: currentLoop.id,
            hour: currentLoop.hour,
            slotPosition: currentSlotIndex,
            assetId: currentSlot?.asset_id
        });

        const timer = setTimeout(() => {
            setCurrentSlotIndex((prev) => (prev + 1) % slots.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [status, playbackMode, currentLoop, currentSlotIndex, screenId]);

    // Current content to display
    const getActiveContent = () => {
        if (playbackMode === 'loop' && currentLoop) {
            const slot = currentLoop.slots?.[currentSlotIndex];
            if (slot?.asset_id) {
                return {
                    url: slot.url || `${API_URL}/api/assets/${slot.asset_id}`,
                    title: slot.asset_name || `Slot ${currentSlotIndex + 1}`,
                    duration: slot.duration || 5,
                    isLoop: true,
                    loopHour: currentLoop.hour,
                    slotPosition: currentSlotIndex
                };
            }
        }

        if (playlist && playlist[currentAdIndex]) {
            return {
                ...playlist[currentAdIndex],
                isLoop: false
            };
        }

        return null;
    };

    const activeContent = getActiveContent();

    if (status === 'playing' && activeContent) {
        return (
            <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black', overflow: 'hidden' }}>
                <img
                    data-testid="ad-image"
                    src={activeContent.url}
                    alt={activeContent.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Debug overlay */}
                <div
                    data-testid="ad-debug-overlay"
                    style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 5, fontSize: 10 }}
                >
                    {activeContent.isLoop ? (
                        <span>🔄 Loop {activeContent.loopHour}:00 | Slot {activeContent.slotPosition + 1}/12 | {activeContent.duration}s</span>
                    ) : (
                        <span>{activeContent.title} | {activeContent.duration}s</span>
                    )}
                </div>
                {/* Loop indicator */}
                {activeContent.isLoop && (
                    <div
                        data-testid="loop-indicator"
                        style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            background: 'rgba(59,130,246,0.8)',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                        }}
                    >
                        LOOP MODE • {currentLoop?.hour}:00
                    </div>
                )}
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
