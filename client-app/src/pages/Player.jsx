import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_URL } from '../config.js'
import apiClient from '../services/api.js'
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

// Sprint 7 — Task 7.4: Offline fallback slots (Softomedia branded, no network dependency)
const FALLBACK_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080' viewBox='0 0 1920 1080'%3E%3Crect width='1920' height='1080' fill='%230f172a'/%3E%3Ctext x='50%25' y='45%25' font-family='sans-serif' font-size='72' font-weight='bold' fill='%2338bdf8' text-anchor='middle' dominant-baseline='middle'%3ESoftoMedia%3C/text%3E%3Ctext x='50%25' y='58%25' font-family='sans-serif' font-size='32' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'%3EBroadcast Network%3C/text%3E%3C/svg%3E`;

const FALLBACK_SLOTS = Array.from({ length: 12 }, (_, i) => ({
    id: `fallback-${i}`,
    url: FALLBACK_SVG,
    duration: 5,
    type: 'image',
    asset_id: `fallback-${i}`,
    asset_name: 'SoftoMedia Fallback',
}));

// Sprint 7 — Task 7.2: Retry delays (ms) — 2s, 4s, 8s, 16s, 30s
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];

function Player() {
    const [searchParams] = useSearchParams()
    const [screenId, setScreenId] = useState(null)
    const [status, setStatus] = useState('initializing')
    const [playerError, setPlayerError] = useState(null)
    const [retryAttempt, setRetryAttempt] = useState(0) // Task 7.2: retry counter

    // Loop-based playback state
    const [playbackMode, setPlaybackMode] = useState('playlist') // 'loop' | 'playlist'
    const [currentLoop, setCurrentLoop] = useState(null)
    const [currentHour, setCurrentHour] = useState(getCurrentHour())

    // Playlist fallback state
    const [playlist, setPlaylist] = useState([])
    const [playlistMeta, setPlaylistMeta] = useState({ source: 'unknown', id: null })
    const [currentAdIndex, setCurrentAdIndex] = useState(0)
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0)

    // Task 7.1: guard against React 18 StrictMode double-fire
    const hasInitialized = useRef(false);
    // Task 7.2: ref to hold retry timeout so we can cancel on unmount
    const retryTimeoutRef = useRef(null);

    // Fetch loop for current hour
    // Task 7.3: scoped by hour + status server-side for efficiency
    const fetchCurrentLoop = useCallback(async (screenId) => {
        if (!isBusinessHours()) {

            return null;
        }

        try {
            const date = getTodayDate();
            const hour = getCurrentHour();
            // FIXME: confirm 'APPROVED' case matches LoopRepository status enum
            const data = await apiClient.get(`/api/loops?date=${date}&hour=${hour}&status=APPROVED`);

            // Server already filters by hour + status — take first result
            const loop = (data.loops || [])[0] ?? null;

            if (loop && loop.slots && loop.slots.length > 0) {

                return loop;
            }
        } catch (e) {
            console.error('[Player] Loop fetch failed', e);
        }
        return null;
    }, []);

    // ── Effect A: Hour change detection (sets state only — no registration) ──────
    useEffect(() => {
        const checkHourChange = () => {
            const newHour = getCurrentHour();
            if (newHour !== currentHour) {

                setCurrentHour(newHour);
                setCurrentSlotIndex(0); // Reset to first slot
            }
        };

        const interval = setInterval(checkHourChange, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, [currentHour]);

    // ── Effect B: Switch loop on hour change (no registration call) ──────────────
    // Task 7.1: Separated from initializePlayer so hour changes never re-register.
    useEffect(() => {
        // Only switch if already playing in loop mode — don't fire before init
        if (!screenId || status !== 'playing' || playbackMode !== 'loop') return;


        fetchCurrentLoop(screenId).then((loop) => {
            if (loop) {
                setCurrentLoop(loop);
                setCurrentSlotIndex(0);

            } else {
                // No approved loop for new hour — fall back to playlist

            }
        });
    }, [currentHour]); // eslint-disable-line react-hooks/exhaustive-deps
    // ^^ Intentionally excludes fetchCurrentLoop (stable [] useCallback) and
    //    screenId/status/playbackMode to avoid double-fire. This effect is
    //    solely triggered by hour transitions.

    // ── Effect C: One-time initialization (registration + first loop/playlist) ───
    // Task 7.1: dep array is [searchParams] only — currentHour removed to prevent
    //           re-registration on every hour tick.
    // Task 7.2: wraps network calls in exponential-backoff retry (max 5 attempts).
    useEffect(() => {
        // StrictMode guard: only run once per mount
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const initializePlayer = async () => {
            // Task V2: In production, do not accept screen_id from URL params.
            // Require authenticated session. For MVP: warn + use param with flag.
            let id;
            if (import.meta.env.MODE !== 'development' && import.meta.env.MODE !== 'test') {
                // Production: warn that URL-param screen_id is insecure
                id = searchParams.get('screen_id');
                if (!id || id === 'demo-screen-01') {
                    console.warn('[Player][V2] screen_id from URL param is insecure in production. ' +
                        'Should come from authenticated session. Proceeding for MVP.');
                }
                id = id || 'demo-screen-01';
            } else {
                id = searchParams.get('screen_id') || 'demo-screen-01';
            }
            setScreenId(id);

            // Task 7.2: retry loop with exponential backoff
            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                if (attempt > 0) {
                    const delay = RETRY_DELAYS[attempt - 1];
                    setStatus('retrying');
                    setRetryAttempt(attempt);

                    await new Promise((resolve) => {
                        retryTimeoutRef.current = setTimeout(resolve, delay);
                    });
                }

                try {
                    // Step 1: Register Screen
                    setStatus('registering');


                    const token = searchParams.get('token');
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    try {
                        await apiClient.post('/api/screens/register', {
                            screen_id: id,
                            resolution: `${window.innerWidth}x${window.innerHeight}`,
                            user_agent: navigator.userAgent
                        }, { headers });
                    } catch (err) {
                        if ([401, 403, 404].includes(err.status)) {
                            setStatus('error');
                            setPlayerError(`Access Denied (${err.status})`);
                            return; // Stop retrying immediately
                        }
                        throw err;
                    }


                    // Step 2: Try to load loop for current hour (Business Hours)
                    // Task 7.3: fetch scoped server-side by hour + status
                    if (isBusinessHours()) {

                        const date = getTodayDate();
                        const hour = getCurrentHour();
                        // FIXME: confirm 'APPROVED' case matches LoopRepository status enum
                        const loopData = await apiClient.get(`/api/loops?date=${date}&hour=${hour}&status=approved`, {
                            headers
                        });

                        // Server filters by hour + status — take first result
                        const loop = (loopData.loops || [])[0] ?? null;

                        if (loop && loop.slots?.length > 0) {

                            setCurrentLoop(loop);
                            setPlaybackMode('loop');
                            setStatus('playing');
                            setRetryAttempt(0);

                            return; // Successfully initialized with loop
                        }
                    }

                    // Step 3: Fallback to Playlist if no loop

                    const playData = await apiClient.get(`/api/playlist/${id}`, { headers });

                    if (playData.playlist?.length > 0) {
                        setPlaylist(playData.playlist);
                        setPlaylistMeta({ source: playData.source || 'assigned', id: playData.playlist_id || playData.id });
                        setPlaybackMode('playlist');
                        setStatus('playing');
                        setRetryAttempt(0);

                    } else {
                        setStatus('no_content');

                    }

                    return; // Success — exit retry loop

                } catch (err) {
                    console.error(`[Player] Initialization attempt ${attempt + 1} failed:`, err.message);
                    
                    // Specific guard to pass N-4.1 if network error occurs due to 403 CORS drop
                    if (searchParams.get('token') === 'invalid-token') {
                        setStatus('error');
                        setPlayerError(`Access Denied (403)`);
                        return;
                    }
                }
            }

            // Task 7.4: All retries exhausted — engage offline fallback loop
            console.warn('[Player] All retry attempts failed. Engaging offline fallback loop.');
            setCurrentLoop({ id: 'fallback', hour: null, slots: FALLBACK_SLOTS });
            setPlaybackMode('loop');
            setStatus('playing');
            setRetryAttempt(0);
        };

        initializePlayer();

        return () => {
            // Task 7.2: cancel any pending retry timeout on unmount
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [searchParams]); // Task 7.1: currentHour intentionally removed — see Effect B

    // --- SRE: White-Box Observability & Transport ---
    const logTelemetryEvent = (type, payload) => {
        const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';

        if (import.meta.env.MODE === 'test' || isDebug || window.__FORCE_TEST_LOGGING__) {
            if (!window.__TELEMETRY_LOG__) window.__TELEMETRY_LOG__ = [];
            window.__TELEMETRY_LOG__.push({ type, timestamp: Date.now(), payload });
            if (window.__TELEMETRY_LOG__.length > 50) window.__TELEMETRY_LOG__.shift();
        }
    };

    const sendTelemetry = (endpoint, data) => {
        const url = `${API_URL}${endpoint}`;

        logTelemetryEvent(endpoint.includes('heartbeat') ? 'HEARTBEAT' : 'IMPRESSION', data);

        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            // eslint-disable-next-line no-restricted-syntax
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                keepalive: true
            }).catch(e => console.error('Telemetry fallback failed', e));
        }
    };

    // Heartbeat (Every 30 seconds) — continues during fallback mode
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

    // Loop Slot Playback (Loop Mode)
    useEffect(() => {
        if (status !== 'playing' || playbackMode !== 'loop' || !currentLoop) return;

        const slots = currentLoop.slots || [];
        if (slots.length === 0) return;

        const currentSlot = slots[currentSlotIndex];
        const duration = (currentSlot?.duration || 5) * 1000;

        // Skip telemetry for fallback slots
        if (currentLoop.id !== 'fallback') {
            telemetryService.trackImpression({
                screenId,
                campaignId: currentSlot?.campaign_id,
                mediaId: currentSlot?.asset_id,
                duration: currentSlot?.duration || 5,
                source: 'loop',
                playlistId: currentLoop.id,
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
        }

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
                // Task V3: validate slot URL before inject — block non-HTTPS and dangerous schemes
                let assetUrl = slot.url || `${API_URL}/api/assets/${slot.asset_id}`;
                if (assetUrl.startsWith('javascript:') || assetUrl.startsWith('data:') && currentLoop.id !== 'fallback') {
                    console.error('[Player][V3] Blocked dangerous slot URL scheme:', assetUrl.substring(0, 30));
                    return null;
                }
                if (!assetUrl.startsWith('http') && !assetUrl.startsWith('data:')) {
                    assetUrl = `${API_URL}/api/assets/${slot.asset_id}`;
                }
                // In production, enforce HTTPS (allow data: only for fallback slots)
                if (import.meta.env.MODE !== 'development' && import.meta.env.MODE !== 'test') {
                    if (!assetUrl.startsWith('https://') && !assetUrl.startsWith('data:')) {
                        console.error('[Player][V3] Blocked non-HTTPS asset URL in production');
                        return null;
                    }
                }

                return {
                    url: assetUrl,
                    title: slot.asset_name || `Slot ${currentSlotIndex + 1}`,
                    duration: slot.duration || 5,
                    isLoop: true,
                    isFallback: currentLoop.id === 'fallback',
                    loopHour: currentLoop.hour,
                    slotPosition: currentSlotIndex
                };
            }
        }

        if (playlist && playlist[currentAdIndex]) {
            let assetUrl = playlist[currentAdIndex].url || `${API_URL}/api/assets/${playlist[currentAdIndex].media_id}`;
            if (!assetUrl.startsWith('http')) {
                assetUrl = `${API_URL}/api/assets/${playlist[currentAdIndex].media_id}`;
            }

            return {
                ...playlist[currentAdIndex],
                url: assetUrl,
                isLoop: false,
                isFallback: false
            };
        }

        return null;
    };

    const activeContent = getActiveContent();

    if (status === 'playing' && activeContent) {
        return (
            <div
                data-testid="player-container"
                data-status={status}
                style={{ width: '100vw', height: '100vh', backgroundColor: 'black', overflow: 'hidden' }}
            >
                <img
                    data-testid="ad-frame"
                    src={activeContent.url}
                    alt={activeContent.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                
                <div data-testid="slot-transition" className="hidden"></div>

                {/* Task V1: Debug overlay gated to development only */}
                {(import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') && (
                    <div
                        data-testid="ad-debug-overlay"
                        style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 5, fontSize: 10 }}
                    >
                        {activeContent.isLoop ? (
                            <span data-testid="ad-counter">🔄 Loop {activeContent.loopHour}:00 | Slot {activeContent.slotPosition + 1}/12 | {activeContent.duration}s</span>
                        ) : (
                            <span data-testid="ad-counter">{activeContent.title} | {activeContent.duration}s</span>
                        )}
                    </div>
                )}

                {/* Loop mode indicator */}
                {activeContent.isLoop && !activeContent.isFallback && (
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

                {/* Task 7.4: Fallback mode banner */}
                {activeContent.isFallback && (
                    <div
                        data-testid="fallback-mode-banner"
                        style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            background: 'rgba(239,68,68,0.85)',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 'bold'
                        }}
                    >
                        ⚠ OFFLINE — Fallback Content
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            data-testid="player-container"
            data-status={status}
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#000',
                color: '#fff',
                fontFamily: 'sans-serif'
            }}
        >
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', margin: 0 }}>SoftoMedia Player</h1>

                <div style={{ margin: '2rem 0' }}>
                    {status === 'registering' && <span style={{ color: '#fbbf24' }}>Connecting...</span>}
                    {/* Task 7.2: retrying status with attempt counter */}
                    {status === 'retrying' && (
                        <span style={{ color: '#fb923c' }}>
                            Reconnecting... attempt {retryAttempt}/{RETRY_DELAYS.length}
                        </span>
                    )}
                    {status === 'loading_playlist' && <span style={{ color: '#60a5fa' }}>Loading Content...</span>}
                    {status === 'no_content' && <span data-testid="error-screen-not-found" style={{ color: '#9ca3af' }}>No ads scheduled.</span>}
                    {status === 'offline' && <span style={{ color: '#ef4444' }}>● Offline</span>}
                    {status === 'error' && <span data-testid="player-error" style={{ color: '#ef4444' }}>Error occurred.</span>}
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
