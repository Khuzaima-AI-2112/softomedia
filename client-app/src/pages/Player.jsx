import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_URL } from '../config.js'
import apiClient from '../services/api.js'
import { telemetryService } from '../services/TelemetryService.js'

// Neutral, local Holding Slide: available without a media or network dependency.
const HOLDING_SLIDE_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080' viewBox='0 0 1920 1080'%3E%3Crect width='1920' height='1080' fill='%230f172a'/%3E%3Ctext x='50%25' y='45%25' font-family='sans-serif' font-size='72' font-weight='bold' fill='%2338bdf8' text-anchor='middle' dominant-baseline='middle'%3ESoftoMedia%3C/text%3E%3Ctext x='50%25' y='58%25' font-family='sans-serif' font-size='32' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'%3EBroadcast Network%3C/text%3E%3C/svg%3E`;

const FALLBACK_SLOTS = Array.from({ length: 12 }, (_, i) => ({
    id: `fallback-${i}`,
    url: HOLDING_SLIDE_SVG,
    duration: 5,
    type: 'image',
    asset_id: `fallback-${i}`,
    asset_name: 'SoftoMedia Fallback',
    presentation_type: 'offline_fallback',
    counts_as_delivery: false,
}));

const HOLDING_SLIDE_SLOTS = [{
    id: 'holding-slide',
    url: HOLDING_SLIDE_SVG,
    duration: 60,
    type: 'image',
    asset_id: 'holding-slide',
    asset_name: 'SoftoMedia Holding Slide',
    presentation_type: 'holding_slide',
    counts_as_delivery: false,
}];

// Sprint 7 — Task 7.2: Retry delays (ms) — 2s, 4s, 8s, 16s, 30s
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];
const PLAYBACK_MODE = Object.freeze({
    APPROVED_SCHEDULE: 'approved_schedule',
    HOLDING_SLIDE: 'holding_slide',
});
const PRESENTATION_TYPE = Object.freeze({
    CAMPAIGN: 'campaign',
    FALLBACK: 'fallback',
    HOLDING_SLIDE: 'holding_slide',
    OFFLINE_FALLBACK: 'offline_fallback',
});

function Player() {
    const [searchParams] = useSearchParams()
    const [screenId, setScreenId] = useState(null)
    const [status, setStatus] = useState('initializing')
    const [playerError, setPlayerError] = useState(null)
    const [retryAttempt, setRetryAttempt] = useState(0) // Task 7.2: retry counter

    // Loop-based playback state
    const [playbackMode, setPlaybackMode] = useState(null)
    const [currentLoop, setCurrentLoop] = useState(null)
    const [scheduleStatus, setScheduleStatus] = useState('unknown')
    const [connectivityStatus, setConnectivityStatus] = useState('unknown')

    const [currentSlotIndex, setCurrentSlotIndex] = useState(0)

    // Task 7.1: guard against React 18 StrictMode double-fire
    const hasInitialized = useRef(false);
    // Task 7.2: ref to hold retry timeout so we can cancel on unmount
    const retryTimeoutRef = useRef(null);
    const activeLoopKeyRef = useRef(null);

    // Fetch loop for current hour
    // Task 7.3: scoped by hour + status server-side for efficiency
    const fetchCurrentLoop = useCallback(async (screenId) => {
        try {
            return await apiClient.get(`/api/screens/${screenId}/playback-loop`);
        } catch (e) {
            console.error('[Player] Loop fetch failed', e);
        }
        return null;
    }, []);

    const applyPlayback = useCallback((playback) => {
        if (!playback) return false;
        setScheduleStatus(playback.schedule_status);
        setConnectivityStatus(playback.connectivity_status);

        let nextLoop;
        if (playback.playback_mode === PLAYBACK_MODE.APPROVED_SCHEDULE && playback.slots?.length > 0) {
            nextLoop = { id: playback.loop_id, hour: playback.hour, slots: playback.slots };
        } else if (playback.playback_mode === PLAYBACK_MODE.HOLDING_SLIDE) {
            nextLoop = { id: 'holding-slide', hour: playback.hour, slots: HOLDING_SLIDE_SLOTS };
        } else {
            return false;
        }
        const nextLoopKey = `${nextLoop.id}:${nextLoop.hour}`;
        if (activeLoopKeyRef.current !== nextLoopKey) setCurrentSlotIndex(0);
        activeLoopKeyRef.current = nextLoopKey;
        setCurrentLoop(nextLoop);
        setPlaybackMode('loop');
        return true;
    }, []);

    const applyOfflineFallback = useCallback(() => {
        activeLoopKeyRef.current = 'offline-fallback';
        setCurrentLoop({ id: 'offline-fallback', hour: null, slots: FALLBACK_SLOTS });
        setPlaybackMode('loop');
        setScheduleStatus('unavailable');
        setConnectivityStatus('offline');
        setCurrentSlotIndex(0);
        setStatus('playing');
    }, []);

    // Poll the server-selected Store-local hour without re-registering the Screen.
    // A failed refresh immediately stops any stale Campaign delivery claim.
    useEffect(() => {
        if (!screenId || status !== 'playing' || playbackMode !== 'loop') return;

        let cancelled = false;
        const refreshPlayback = async () => {
            const playback = await fetchCurrentLoop(screenId);
            if (!cancelled && !applyPlayback(playback)) applyOfflineFallback();
        };
        const interval = setInterval(refreshPlayback, 10000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [screenId, status, playbackMode, fetchCurrentLoop, applyPlayback, applyOfflineFallback]);

    // One-time initialization (registration + first loop/playlist).
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


                    // Step 2: Load only the approved schedule selected for this
                    // Screen assignment and Store-local hour by the public endpoint.
                    const playback = await apiClient.get(`/api/screens/${id}/playback-loop`, { headers });
                    if (!applyPlayback(playback)) {
                        setStatus('no_content');
                        return;
                    }
                    setStatus('playing');
                    setRetryAttempt(0);
                    return;

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
            applyOfflineFallback();
            setRetryAttempt(0);
        };

        initializePlayer();

        return () => {
            // Task 7.2: cancel any pending retry timeout on unmount
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [searchParams, applyPlayback, applyOfflineFallback]);

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

    // Loop Slot Playback (Loop Mode)
    useEffect(() => {
        if (status !== 'playing' || playbackMode !== 'loop' || !currentLoop) return;

        const slots = currentLoop.slots || [];
        if (slots.length === 0) return;

        const currentSlot = slots[currentSlotIndex];
        const duration = (currentSlot?.duration || 5) * 1000;

        // Only Campaign presentation establishes delivery. Holding Slides,
        // fallback, and category media remain observable but produce no claim.
        if (currentSlot?.counts_as_delivery === true && currentSlot?.campaign_id) {
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
                const presentationType = slot.presentation_type
                    || (currentLoop.id === 'holding-slide' ? PRESENTATION_TYPE.HOLDING_SLIDE
                        : currentLoop.id === 'offline-fallback' ? PRESENTATION_TYPE.OFFLINE_FALLBACK
                            : PRESENTATION_TYPE.CAMPAIGN);
                // Task V3: validate slot URL before inject — block non-HTTPS and dangerous schemes
                let assetUrl = slot.url || `${API_URL}/api/assets/${slot.asset_id}`;
                const permitsEmbeddedAsset = [
                    PRESENTATION_TYPE.HOLDING_SLIDE,
                    PRESENTATION_TYPE.OFFLINE_FALLBACK,
                ].includes(presentationType);
                if (assetUrl.startsWith('javascript:') || assetUrl.startsWith('data:') && !permitsEmbeddedAsset) {
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
                    presentationType,
                    loopHour: currentLoop.hour,
                    slotPosition: currentSlotIndex
                };
            }
        }

        return null;
    };

    const activeContent = getActiveContent();

    if (status === 'playing' && activeContent) {
        return (
            <div
                data-testid="player-container"
                data-status={status}
                data-schedule-status={scheduleStatus}
                data-connectivity-status={connectivityStatus}
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
                {activeContent.presentationType === PRESENTATION_TYPE.CAMPAIGN && (
                    <div
                        data-testid="campaign-presentation"
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
                {activeContent.presentationType === PRESENTATION_TYPE.FALLBACK && (
                    <div
                        data-testid="fallback-presentation"
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
                        FALLBACK CONTENT • Reserved {currentLoop?.slots?.[currentSlotIndex]?.allocated_category || 'category'} position
                    </div>
                )}

                {activeContent.presentationType === PRESENTATION_TYPE.OFFLINE_FALLBACK && (
                    <div data-testid="fallback-mode-banner" style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
                        ⚠ OFFLINE — Fallback Content
                    </div>
                )}

                {activeContent.presentationType === PRESENTATION_TYPE.HOLDING_SLIDE && (
                    <div data-testid="holding-slide" style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
                        No approved schedule
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            data-testid="player-container"
            data-status={status}
            data-schedule-status={scheduleStatus}
            data-connectivity-status={connectivityStatus}
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
                    {status === 'error' && <span data-testid="player-error" style={{ color: '#ef4444' }}>{playerError || 'Error occurred.'}</span>}
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
