import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import apiService from '../services/ApiService';

const SLOT_DURATION = 5000;
const TOTAL_SLOTS = 12;

const DEMO_CONTENT = [
    { color: 'from-blue-500 to-blue-700', text: 'Your Ad Here', icon: 'campaign' },
    { color: 'from-purple-500 to-purple-700', text: 'Premium Slot', icon: 'star' },
    { color: 'from-emerald-500 to-emerald-700', text: 'Available', icon: 'add_circle' },
    { color: 'from-amber-500 to-amber-700', text: 'Book Now', icon: 'shopping_cart' },
    { color: 'from-rose-500 to-rose-700', text: 'Advertise', icon: 'storefront' },
    { color: 'from-cyan-500 to-cyan-700', text: 'Reach Millions', icon: 'visibility' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getRole() {
    return localStorage.getItem('demo_role') || localStorage.getItem('active_persona') || '';
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function LoopDemoPlayer() {
    // ── role ────────────────────────────────────────────────────────────────
    const role = getRole();
    const isSuperAdmin = role === 'superadmin';

    // ── 4.1 / 4.3 — cascade selection state ────────────────────────────────
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);

    const [selectedRetailerId, setSelectedRetailerId] = useState('');
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [selectedScreenId, setSelectedScreenId] = useState('');
    const [selectedDate, setSelectedDate] = useState(todayISO());

    const [retailersLoading, setRetailersLoading] = useState(false);
    const [storesLoading, setStoresLoading] = useState(false);
    const [screensLoading, setScreensLoading] = useState(false);

    // ── 4.2 — playback state ─────────────────────────────────────────────
    const [allLoops, setAllLoops] = useState([]);       // full-day loops array
    const [currentLoopIndex, setCurrentLoopIndex] = useState(0);
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [playbackLoading, setPlaybackLoading] = useState(false);

    // ── UI ──────────────────────────────────────────────────────────────────
    const [showOverlay, setShowOverlay] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [error, setError] = useState(null);

    const intervalRef = useRef(null);
    const progressRef = useRef(null);

    // ── Load retailers on mount ─────────────────────────────────────────────
    // Task 4.1 step 1 + Task 4.3: fetch all active retailers for both the
    // cascade selector and the superadmin Retailer Context selector.
    useEffect(() => {
        (async () => {
            setRetailersLoading(true);
            try {
                const data = await apiService.getRetailers();
                setRetailers(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Failed to load retailers', e);
            } finally {
                setRetailersLoading(false);
            }
        })();
    }, []);

    // ── Task 4.1 step 2: load stores when retailer changes ──────────────────
    useEffect(() => {
        if (!selectedRetailerId) return;
        setStores([]);
        setSelectedStoreId('');
        setScreens([]);
        setSelectedScreenId('');
        setAllLoops([]);
        setIsPlaying(false);

        (async () => {
            setStoresLoading(true);
            try {
                const data = await apiService.getStores({ retailerid: selectedRetailerId });
                setStores(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Failed to load stores', e);
            } finally {
                setStoresLoading(false);
            }
        })();
    }, [selectedRetailerId]);

    // ── Task 4.1 step 3: load screens when store changes ────────────────────
    useEffect(() => {
        if (!selectedStoreId) return;
        setScreens([]);
        setSelectedScreenId('');
        setAllLoops([]);
        setIsPlaying(false);

        (async () => {
            setScreensLoading(true);
            try {
                const data = await apiService.getScreens({ storeid: selectedStoreId });
                setScreens(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Failed to load screens', e);
            } finally {
                setScreensLoading(false);
            }
        })();
    }, [selectedStoreId]);

    // ── Task 4.1: reset screen selection when screen dropdown changes ────────
    const handleRetailerChange = (e) => {
        setSelectedRetailerId(e.target.value);
    };

    const handleStoreChange = (e) => {
        setSelectedStoreId(e.target.value);
    };

    const handleScreenChange = (e) => {
        setSelectedScreenId(e.target.value);
        setAllLoops([]);
        setIsPlaying(false);
    };

    // ── All three selected? ─────────────────────────────────────────────────
    const selectionComplete = !!(selectedRetailerId && selectedStoreId && selectedScreenId);

    // ── Task 4.2: fetch full-day loops on Play ──────────────────────────────
    const handlePlay = useCallback(async () => {
        if (!selectionComplete) return;
        setError(null);
        setPlaybackLoading(true);
        try {
            const data = await apiService.getLoops({
                screenid: selectedScreenId,
                date: selectedDate,
            });

            // Backend returns { loops: [...], business_hours: {...} }
            // Guard also handles a bare array in case of legacy/mock callers
            const loops = Array.isArray(data)
                ? data
                : Array.isArray(data?.loops)
                ? data.loops
                : [];

            if (loops.length === 0) {
                setError('No loops scheduled for this screen and date.');
                setPlaybackLoading(false);
                return;
            }
            setAllLoops(loops);
            setCurrentLoopIndex(0);
            setCurrentSlotIndex(0);
            setProgress(0);
            setIsPlaying(true);
        } catch (e) {
            console.error('Failed to load loops', e);
            setError('Could not load playback schedule. Check API connection.');
        } finally {
            setPlaybackLoading(false);
        }
    }, [selectionComplete, selectedScreenId, selectedDate]);

    const handleStop = useCallback(() => {
        setIsPlaying(false);
        setCurrentLoopIndex(0);
        setCurrentSlotIndex(0);
        setProgress(0);
        setAllLoops([]);
    }, []);

    const togglePlayPause = useCallback(() => {
        if (!isPlaying && allLoops.length === 0) {
            handlePlay();
        } else {
            setIsPlaying(prev => !prev);
        }
    }, [isPlaying, allLoops, handlePlay]);

    // ── Task 4.2: slot + loop advancement ──────────────────────────────────
    // Play all slots of the current loop in order (0→11), then advance to
    // the next loop. After all loops in the day have played, restart cycle.
    useEffect(() => {
        if (!isPlaying || allLoops.length === 0) return;

        progressRef.current = setInterval(() => {
            setProgress(prev => (prev >= 100 ? 0 : prev + (100 / (SLOT_DURATION / 100))));
        }, 100);

        intervalRef.current = setInterval(() => {
            setCurrentSlotIndex(prevSlot => {
                const nextSlot = prevSlot + 1;
                if (nextSlot < TOTAL_SLOTS) {
                    return nextSlot;
                }
                // Slot cycle done — advance to next loop
                setCurrentLoopIndex(prevLoop => (prevLoop + 1) % allLoops.length);
                return 0;
            });
            setProgress(0);
        }, SLOT_DURATION);

        return () => {
            clearInterval(intervalRef.current);
            clearInterval(progressRef.current);
        };
    }, [isPlaying, allLoops]);

    // ── Current loop & slot content ─────────────────────────────────────────
    const currentLoop = allLoops[currentLoopIndex] ?? null;

    const slotContent = useMemo(() => {
        if (currentLoop?.slots?.[currentSlotIndex]) {
            const slot = currentLoop.slots[currentSlotIndex];
            const isBooked =
                slot.status?.toLowerCase() === 'booked' || slot.status === 'BOOKED';
            if (isBooked && slot.creative_url) {
                return {
                    type: 'ad',
                    content: {
                        creative_url: slot.creative_url,
                        campaign_name: slot.campaign_name || 'Campaign Content',
                        advertiser_name: slot.advertiser_name || 'Verified Partner',
                    },
                };
            }
        }
        return {
            type: 'demo',
            content: DEMO_CONTENT[currentSlotIndex % DEMO_CONTENT.length],
        };
    }, [currentLoop, currentSlotIndex]);

    const goToSlot = useCallback((index) => {
        setCurrentSlotIndex(index);
        setProgress(0);
    }, []);

    // ── Clock ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const formatTime = (date) =>
        date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

    // ── Helpers for labels ──────────────────────────────────────────────────
    const selectedRetailerName =
        retailers.find(r => (r.id || r.retailerid) === selectedRetailerId)?.name ?? '';
    const selectedStoreName =
        stores.find(s => (s.id || s.storeid) === selectedStoreId)?.name ?? '';
    const selectedScreenName =
        screens.find(s => (s.id || s.screenid || s.screen_id) === selectedScreenId)?.name ?? selectedScreenId;

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">

            {/* ── HEADER / COMMAND CENTER ───────────────────────────────── */}
            <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 flex-wrap">

                    {/* Title + Task 4.3: superadmin Retailer Context selector */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-xl">smart_display</span>
                            </div>
                            <h1 className="text-lg font-black tracking-tight">Retailer Command Center</h1>
                        </div>

                        {/* Task 4.3 — visible only for superadmin */}
                        {isSuperAdmin && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-white/40 font-bold uppercase tracking-widest whitespace-nowrap">
                                    Retailer Context
                                </label>
                                <select
                                    value={selectedRetailerId}
                                    onChange={handleRetailerChange}
                                    disabled={retailersLoading}
                                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
                                >
                                    <option value="">
                                        {retailersLoading ? 'Loading…' : '— Select Retailer —'}
                                    </option>
                                    {retailers.map(r => (
                                        <option key={r.id || r.retailerid} value={r.id || r.retailerid}>
                                            {r.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Date picker */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-white/40 font-bold uppercase tracking-widest">
                            Date
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => {
                                setSelectedDate(e.target.value);
                                setAllLoops([]);
                                setIsPlaying(false);
                            }}
                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>
            </div>

            {/* ── TASK 4.1: CASCADE SELECTORS ──────────────────────────────── */}
            <div className="bg-slate-900/50 border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {/* Step 1 — Retailer (only rendered for non-superadmin here;
                        superadmin uses the header context selector above) */}
                    {!isSuperAdmin && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-white/40 font-bold uppercase tracking-widest">
                                1 · Retailer
                            </label>
                            <select
                                value={selectedRetailerId}
                                onChange={handleRetailerChange}
                                disabled={retailersLoading}
                                className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            >
                                <option value="">
                                    {retailersLoading ? 'Loading…' : '— Select Retailer —'}
                                </option>
                                {retailers.map(r => (
                                    <option key={r.id || r.retailerid} value={r.id || r.retailerid}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Step 2 — Store */}
                    <div className={`flex flex-col gap-1 ${!isSuperAdmin ? '' : 'col-span-1'}`}>
                        <label className="text-xs text-white/40 font-bold uppercase tracking-widest">
                            {isSuperAdmin ? '1' : '2'} · Store
                        </label>
                        <select
                            value={selectedStoreId}
                            onChange={handleStoreChange}
                            disabled={!selectedRetailerId || storesLoading}
                            className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">
                                {!selectedRetailerId
                                    ? 'Select a Retailer first'
                                    : storesLoading
                                    ? 'Loading…'
                                    : stores.length === 0
                                    ? 'No stores found'
                                    : '— Select Store —'}
                            </option>
                            {stores.map(s => (
                                <option key={s.id || s.storeid} value={s.id || s.storeid}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 3 — Screen */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/40 font-bold uppercase tracking-widest">
                            {isSuperAdmin ? '2' : '3'} · Screen
                        </label>
                        <select
                            value={selectedScreenId}
                            onChange={handleScreenChange}
                            disabled={!selectedStoreId || screensLoading}
                            className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">
                                {!selectedStoreId
                                    ? 'Select a Store first'
                                    : screensLoading
                                    ? 'Loading…'
                                    : screens.length === 0
                                    ? 'No screens found'
                                    : '— Select Screen —'}
                            </option>
                            {screens.map(s => (
                                <option
                                    key={s.id || s.screenid || s.screen_id}
                                    value={s.id || s.screenid || s.screen_id}
                                >
                                    {s.name || s.screen_id}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Play / Stop controls — disabled until all 3 selected (Task 4.1) */}
                <div className="max-w-7xl mx-auto mt-4 flex items-center gap-4">
                    <button
                        onClick={handlePlay}
                        disabled={!selectionComplete || playbackLoading || isPlaying}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
                    >
                        <span className="material-symbols-outlined text-xl">play_circle</span>
                        {playbackLoading ? 'Loading Schedule…' : 'Play Full Day'}
                    </button>

                    {isPlaying && (
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 font-bold text-sm hover:bg-white/20 transition-all"
                        >
                            <span className="material-symbols-outlined text-xl">stop_circle</span>
                            Stop
                        </button>
                    )}

                    {!selectionComplete && (
                        <p className="text-xs text-white/30 italic">
                            Select Retailer → Store → Screen to enable playback
                        </p>
                    )}

                    {error && (
                        <p className="text-xs text-rose-400 font-semibold">{error}</p>
                    )}
                </div>
            </div>

            {/* ── PLAYER ────────────────────────────────────────────────────── */}
            {isPlaying && allLoops.length > 0 ? (
                <div
                    className="flex-1 flex items-center justify-center bg-black relative overflow-hidden"
                    onMouseMove={() => setShowOverlay(true)}
                    onMouseLeave={() => setShowOverlay(false)}
                >
                    <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] bg-slate-900">

                        {/* Content */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            {slotContent.type === 'ad' ? (
                                <div className="w-full h-full relative">
                                    <img
                                        key={`${currentLoopIndex}-${currentSlotIndex}`}
                                        src={slotContent.content.creative_url}
                                        alt="Advertisement"
                                        className="w-full h-full object-cover animate-in fade-in duration-500"
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                    <div className="absolute bottom-20 right-4 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-white text-sm max-w-xs shadow-2xl border border-white/10">
                                        <p className="font-bold truncate">{slotContent.content.campaign_name}</p>
                                        <p className="text-white/60 text-xs">{slotContent.content.advertiser_name}</p>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    key={`${currentLoopIndex}-${currentSlotIndex}`}
                                    className={`w-full h-full bg-gradient-to-br ${slotContent.content.color} flex flex-col items-center justify-center animate-in fade-in duration-500`}
                                >
                                    <span className="material-symbols-outlined text-white/80 text-[120px] mb-4">
                                        {slotContent.content.icon}
                                    </span>
                                    <h2 className="text-white text-5xl font-black tracking-tight">
                                        {slotContent.content.text}
                                    </h2>
                                    <p className="text-white/60 text-xl mt-2">
                                        Slot {currentSlotIndex + 1} of {TOTAL_SLOTS}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        {/* Slot dots */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                            {Array.from({ length: TOTAL_SLOTS }).map((_, index) => {
                                const isBooked =
                                    currentLoop?.slots?.[index]?.status?.toLowerCase() === 'booked' ||
                                    currentLoop?.slots?.[index]?.status === 'BOOKED';
                                return (
                                    <button
                                        key={index}
                                        onClick={() => goToSlot(index)}
                                        className={`
                                            w-10 h-1.5 rounded-full transition-all duration-300
                                            ${index === currentSlotIndex
                                                ? 'bg-white scale-110 shadow-[0_0_10px_white]'
                                                : isBooked
                                                    ? 'bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)]'
                                                    : index < currentSlotIndex
                                                        ? 'bg-white/40'
                                                        : 'bg-white/10'}
                                            hover:bg-white/80
                                        `}
                                        title={`Slot ${index + 1}${isBooked ? ' (Booked)' : ''}`}
                                    />
                                );
                            })}
                        </div>

                        {/* Top overlay */}
                        <div className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/90 to-transparent transition-all duration-500 ${showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                            <div className="flex items-center justify-between text-white">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-xl">tv</span>
                                        </div>
                                        <span className="text-xl font-black tracking-tight">
                                            {selectedScreenName.toUpperCase()}
                                        </span>
                                    </div>
                                    {selectedStoreName && (
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5">
                                            <span className="material-symbols-outlined text-sm text-primary">storefront</span>
                                            <span className="text-sm font-bold">{selectedStoreName}</span>
                                        </div>
                                    )}
                                    {/* Task 4.2 — loop indicator */}
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5">
                                        <span className="material-symbols-outlined text-sm text-primary">repeat</span>
                                        <span className="text-sm font-bold">
                                            Loop {currentLoopIndex + 1} / {allLoops.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Current Time</p>
                                        <p className="font-mono text-xl font-bold">{formatTime(currentTime)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Loop Status</p>
                                        <p className="font-mono text-xl font-bold text-primary">
                                            {String(Math.floor(currentSlotIndex * 5 + (progress / 100) * 5)).padStart(2, '0')}s / 60s
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom controls */}
                        <div className={`absolute bottom-16 left-0 right-0 px-4 flex items-center justify-center gap-6 transition-all duration-500 ${showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <button
                                onClick={() => goToSlot((currentSlotIndex - 1 + TOTAL_SLOTS) % TOTAL_SLOTS)}
                                className="size-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center hover:scale-110"
                            >
                                <span className="material-symbols-outlined text-3xl">skip_previous</span>
</button>
                            <button
                                onClick={togglePlayPause}
                                className="size-20 rounded-full bg-primary text-white hover:bg-primary/90 transition-all shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] flex items-center justify-center hover:scale-105"
                            >
                                <span className="material-symbols-outlined text-5xl">
                                    {isPlaying ? 'pause' : 'play_arrow'}
                                </span>
                            </button>
                            <button
                                onClick={() => goToSlot((currentSlotIndex + 1) % TOTAL_SLOTS)}
                                className="size-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center hover:scale-110"
                            >
                                <span className="material-symbols-outlined text-3xl">skip_next</span>
                            </button>
                        </div>

                        {/* Slot counter badge */}
                        <div className="absolute top-8 right-8 px-6 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white shadow-2xl">
                            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">Active Slot</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-primary">{currentSlotIndex + 1}</span>
                                <span className="text-white/40 text-xl font-bold"> / {TOTAL_SLOTS}</span>
                            </div>
                        </div>

                        {/* Exit */}
                        <a
                            href="/dashboard"
                            className={`absolute top-8 left-8 size-12 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white hover:bg-primary transition-all duration-500 flex items-center justify-center transform ${showOverlay ? 'opacity-100' : 'opacity-0 -translate-x-4'}`}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </a>
                    </div>

                    <style>{`
                        @keyframes slideIn {
                            from { opacity: 0; transform: scale(1.05) translateY(10px); }
                            to   { opacity: 1; transform: scale(1) translateY(0); }
                        }
                        .animate-in { animation: slideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
                    `}</style>
                </div>
            ) : (
                /* ── Idle / pre-play state ─────────────────────────────── */
                <div className="flex-1 flex flex-col items-center justify-center gap-6 text-white/30">
                    <span className="material-symbols-outlined text-[80px]">smart_display</span>
                    <p className="text-lg font-bold tracking-widest uppercase">
                        {selectionComplete
                            ? 'Press Play Full Day to begin'
                            : 'Complete selection above to start playback'}
                    </p>
                    {selectionComplete && (
                        <p className="text-sm">
                            {selectedRetailerName} → {selectedStoreName} → {selectedScreenName}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default LoopDemoPlayer;
