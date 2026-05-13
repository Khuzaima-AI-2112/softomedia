import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tv, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import apiService from '../services/ApiService';

const SLOT_DURATION = 5000;
const TOTAL_SLOTS = 12;

const DEMO_CONTENT = [
    { color: ['#3b82f6', '#1d4ed8'], text: 'Your Ad Here' },
    { color: ['#a855f7', '#7e22ce'], text: 'Premium Slot' },
    { color: ['#10b981', '#065f46'], text: 'Available' },
    { color: ['#f59e0b', '#92400e'], text: 'Book Now' },
    { color: ['#f43f5e', '#9f1239'], text: 'Advertise' },
    { color: ['#06b6d4', '#164e63'], text: 'Reach Millions' },
];

function LoopDemoPlayer() {
    const [searchParams] = useSearchParams();
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const [isPlaying, setIsPlaying]               = useState(true);
    const [progress, setProgress]                 = useState(0);
    const [loop, setLoop]                         = useState(null);
    const [screen, setScreen]                     = useState(null);
    const [store, setStore]                       = useState(null);
    const [showOverlay, setShowOverlay]           = useState(false);
    const [currentTime, setCurrentTime]           = useState(new Date());
    const [bookedCreatives, setBookedCreatives]   = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [allLoops, setAllLoops]                 = useState([]);
    const [currentHourIndex, setCurrentHourIndex] = useState(0);

    const intervalRef  = useRef(null);
    const progressRef  = useRef(null);

    useEffect(() => { loadData(); }, [searchParams]);

    const loadData = async () => {
        try {
            setLoading(true);
            const screenId = searchParams.get('screen');
            const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

            const allCampaigns = await apiService.getCampaigns();
            const activeCampaigns = allCampaigns.filter(c =>
                c.creative_url &&
                ['live', 'active', 'approved'].includes((c.status || '').toLowerCase())
            );
            setBookedCreatives(activeCampaigns);

            let targetScreen = null;
            if (screenId) {
                targetScreen = await apiService.getScreen(screenId);
            } else {
                const screens = await apiService.getScreens();
                if (screens.length > 0) targetScreen = screens[0];
            }

            if (targetScreen) {
                setScreen(targetScreen);
                const storeId = targetScreen.store_id || targetScreen.storeId;
                const [storeData, loopsData] = await Promise.all([
                    storeId ? apiService.getStore(storeId) : Promise.resolve(null),
                    apiService.getLoops({ screenId: targetScreen.id || targetScreen.screen_id, date }),
                ]);
                setStore(storeData);
                const dailyLoops = loopsData.loops || (Array.isArray(loopsData) ? loopsData : []);
                setAllLoops(dailyLoops);
                const paramHour  = searchParams.get('hour');
                const defaultHour = parseInt(paramHour || new Date().getHours());
                let startIndex = dailyLoops.findIndex(l => l.hour === defaultHour);
                if (startIndex === -1) startIndex = 0;
                setCurrentHourIndex(startIndex);
                setLoop(dailyLoops[startIndex] || null);
            }
        } catch (e) { console.error('Failed to load player data:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!isPlaying || loading) return;
        progressRef.current = setInterval(() => {
            setProgress(prev => prev >= 100 ? 0 : prev + (100 / (SLOT_DURATION / 100)));
        }, 100);
        intervalRef.current = setInterval(() => {
            setCurrentSlotIndex(prev => {
                const next = prev + 1;
                if (next >= TOTAL_SLOTS) {
                    if (allLoops.length > 0) {
                        const nextHour = (currentHourIndex + 1) % allLoops.length;
                        setCurrentHourIndex(nextHour);
                        setLoop(allLoops[nextHour]);
                    }
                    return 0;
                }
                return next;
            });
            setProgress(0);
        }, SLOT_DURATION);
        return () => {
            clearInterval(intervalRef.current);
            clearInterval(progressRef.current);
        };
    }, [isPlaying, loading, allLoops, currentHourIndex]);

    const slotContent = useMemo(() => {
        if (loop?.slots?.[currentSlotIndex]) {
            const slot = loop.slots[currentSlotIndex];
            if (['booked', 'BOOKED'].includes(slot.status) && slot.creative_url) {
                return { type: 'ad', content: { creative_url: slot.creative_url, campaign_name: slot.campaign_name || 'Campaign Content', advertiser_name: slot.advertiser_name || 'Verified Partner' } };
            }
        }
        if (bookedCreatives.length > 0) {
            const c = bookedCreatives[currentSlotIndex % bookedCreatives.length];
            return { type: 'campaign', content: { creative_url: c.creative_url, campaign_name: c.name, advertiser_name: c.advertiser_name || 'Network Partner' } };
        }
        return { type: 'demo', content: DEMO_CONTENT[currentSlotIndex % DEMO_CONTENT.length] };
    }, [loop, currentSlotIndex, bookedCreatives]);

    const togglePlayPause = useCallback(() => setIsPlaying(p => !p), []);
    const goToSlot = useCallback((i) => { setCurrentSlotIndex(i); setProgress(0); }, []);
    const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    /* ------------------------------------------------------------------ */
    /* Loading screen                                                       */
    /* ------------------------------------------------------------------ */
    if (loading) return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '4px solid #6366f1', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#6366f1', fontWeight: 800, letterSpacing: '0.15em', fontSize: 13 }}>SYNCHRONIZING BROADCAST…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    /* ------------------------------------------------------------------ */
    /* Main player                                                          */
    /* ------------------------------------------------------------------ */
    return (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            onMouseMove={() => setShowOverlay(true)}
            onMouseLeave={() => setShowOverlay(false)}
        >
            <style>{`
                @keyframes fadeIn  { from { opacity:0; transform:scale(1.04); } to { opacity:1; transform:scale(1); } }
                @keyframes spinKf  { to { transform: rotate(360deg); } }
                .slot-fade { animation: fadeIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
            `}</style>

            {/*
              16:9 container — object-fit:cover fills it edge-to-edge.
              max-w / max-h clamp to 16:9 within the viewport so no grey bars appear.
              We use aspect-ratio:16/9 + width:100% so it scales correctly.
            */}
            <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                maxWidth: '177.78vh',  /* = 100vh * 16/9 */
                maxHeight: '100vh',
                backgroundColor: '#000',
                overflow: 'hidden',
            }}>

                {/* ---- Content ---- */}
                <div style={{ position: 'absolute', inset: 0 }}>
                    {slotContent.type === 'ad' || slotContent.type === 'campaign' ? (
                        <div className="slot-fade" key={currentSlotIndex} style={{ width: '100%', height: '100%', position: 'relative' }}>
                            <img
                                src={slotContent.content.creative_url}
                                alt="Advertisement"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                        </div>
                    ) : (
                        <div
                            className="slot-fade"
                            key={currentSlotIndex}
                            style={{
                                width: '100%', height: '100%',
                                background: `linear-gradient(135deg, ${slotContent.content.color[0]}, ${slotContent.content.color[1]})`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <h2 style={{ color: '#fff', fontSize: '4rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
                                {slotContent.content.text}
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.25rem', marginTop: 12 }}>
                                Slot {currentSlotIndex + 1} of {TOTAL_SLOTS}
                            </p>
                        </div>
                    )}
                </div>

                {/* ---- Bottom campaign info card (backdrop blur) ---- */}
                {(slotContent.type === 'ad' || slotContent.type === 'campaign') && (
                    <div style={{
                        position: 'absolute', bottom: 72, right: 20,
                        padding: '10px 14px',
                        borderRadius: 12,
                        backgroundColor: 'rgba(15,15,20,0.72)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        maxWidth: 220,
                    }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slotContent.content.campaign_name}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '2px 0 0' }}>
                            {slotContent.content.advertiser_name}
                        </p>
                    </div>
                )}

                {/* ---- Slot progress bar ---- */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#fff', transition: 'width 100ms linear', boxShadow: '0 0 12px rgba(255,255,255,0.8)' }} />
                </div>

                {/* ---- Progress dots ---- */}
                {/* 44px tap area via padding; 8px dot, active = 16px pill */}
                <div style={{
                    position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 6, alignItems: 'center',
                }}>
                    {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
                        const isActive = i === currentSlotIndex;
                        const isBooked = ['booked', 'BOOKED'].includes(loop?.slots?.[i]?.status);
                        return (
                            <button
                                key={i}
                                onClick={() => goToSlot(i)}
                                title={`Slot ${i + 1}${isBooked ? ' (Booked)' : ''}`}
                                style={{
                                    /* 44px tap target */
                                    padding: '18px 0',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <span style={{
                                    display: 'block',
                                    width:  isActive ? 16 : 8,
                                    height: 8,
                                    borderRadius: 9999,
                                    backgroundColor: isActive
                                        ? '#fff'
                                        : isBooked
                                            ? '#6366f1'
                                            : i < currentSlotIndex
                                                ? 'rgba(255,255,255,0.4)'
                                                : 'rgba(255,255,255,0.15)',
                                    boxShadow: isActive ? '0 0 8px rgba(255,255,255,0.9)' : isBooked ? '0 0 6px rgba(99,102,241,0.7)' : 'none',
                                    transition: 'all 0.25s ease',
                                }} />
                            </button>
                        );
                    })}
                </div>

                {/* ---- Active Slot pill badge (top-right) ---- */}
                <div style={{
                    position: 'absolute', top: 20, right: 20,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px',
                    borderRadius: 9999,
                    backgroundColor: 'rgba(15,15,25,0.75)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)' }}>Active Slot</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#818cf8', fontVariantNumeric: 'tabular-nums' }}>
                        {currentSlotIndex + 1}<span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}> / {TOTAL_SLOTS}</span>
                    </span>
                </div>

                {/* ---- Top info bar (hover) ---- */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 24px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
                    transition: 'opacity 0.4s, transform 0.4s',
                    opacity: showOverlay ? 1 : 0,
                    transform: showOverlay ? 'translateY(0)' : 'translateY(-10px)',
                    pointerEvents: showOverlay ? 'auto' : 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Tv size={16} color="#fff" />
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em' }}>
                                    {(screen?.name || screen?.screen_id || 'DEMO SCREEN').toUpperCase()}
                                </span>
                            </div>
                            {store && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>{store.name}</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 32 }}>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 2px' }}>Current Time</p>
                                <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, margin: 0 }}>{formatTime(currentTime)}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 2px' }}>Loop Status</p>
                                <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#818cf8', margin: 0 }}>
                                    {String(Math.floor(currentSlotIndex * 5 + (progress / 100) * 5)).padStart(2, '0')}s / 60s
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---- Bottom controls (hover) ---- */}
                <div style={{
                    position: 'absolute', bottom: 58, left: 0, right: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                    transition: 'opacity 0.4s, transform 0.4s',
                    opacity: showOverlay ? 1 : 0,
                    transform: showOverlay ? 'translateY(0)' : 'translateY(12px)',
                    pointerEvents: showOverlay ? 'auto' : 'none',
                }}>
                    {[{ icon: <SkipBack size={22} />, action: () => goToSlot((currentSlotIndex - 1 + TOTAL_SLOTS) % TOTAL_SLOTS), size: 44 },
                      { icon: isPlaying ? <Pause size={30} /> : <Play size={30} />, action: togglePlayPause, size: 64, primary: true },
                      { icon: <SkipForward size={22} />, action: () => goToSlot((currentSlotIndex + 1) % TOTAL_SLOTS), size: 44 },
                    ].map(({ icon, action, size, primary }, i) => (
                        <button
                            key={i}
                            onClick={action}
                            style={{
                                width: size, height: size, borderRadius: '50%',
                                backgroundColor: primary ? '#6366f1' : 'rgba(255,255,255,0.12)',
                                backdropFilter: 'blur(8px)',
                                border: primary ? 'none' : '1px solid rgba(255,255,255,0.12)',
                                color: '#fff', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'transform 0.15s, background-color 0.15s',
                                boxShadow: primary ? '0 0 24px rgba(99,102,241,0.5)' : 'none',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >{icon}</button>
                    ))}
                </div>

                {/* ---- Exit button (hover) ---- */}
                <a
                    href="/dashboard"
                    style={{
                        position: 'absolute', top: 20, left: 20,
                        width: 40, height: 40, borderRadius: 10,
                        backgroundColor: 'rgba(15,15,25,0.75)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', textDecoration: 'none',
                        transition: 'opacity 0.4s, transform 0.4s, background-color 0.2s',
                        opacity: showOverlay ? 1 : 0,
                        transform: showOverlay ? 'translateX(0)' : 'translateX(-10px)',
                        pointerEvents: showOverlay ? 'auto' : 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#6366f1'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(15,15,25,0.75)'; }}
                >
                    <X size={18} />
                </a>

            </div>
        </div>
    );
}

export default LoopDemoPlayer;
