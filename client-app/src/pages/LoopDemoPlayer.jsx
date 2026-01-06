import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiService from '../services/ApiService';

const SLOT_DURATION = 5000; // 5 seconds in milliseconds
const TOTAL_SLOTS = 12;
const LOOP_DURATION = SLOT_DURATION * TOTAL_SLOTS; // 60 seconds

// Demo content for empty slots
const DEMO_CONTENT = [
    { color: 'from-blue-500 to-blue-700', text: 'Your Ad Here', icon: 'campaign' },
    { color: 'from-purple-500 to-purple-700', text: 'Premium Slot', icon: 'star' },
    { color: 'from-emerald-500 to-emerald-700', text: 'Available', icon: 'add_circle' },
    { color: 'from-amber-500 to-amber-700', text: 'Book Now', icon: 'shopping_cart' },
    { color: 'from-rose-500 to-rose-700', text: 'Advertise', icon: 'storefront' },
    { color: 'from-cyan-500 to-cyan-700', text: 'Reach Millions', icon: 'visibility' }
];

function LoopDemoPlayer() {
    const [searchParams] = useSearchParams();
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [loop, setLoop] = useState(null);
    const [screen, setScreen] = useState(null);
    const [store, setStore] = useState(null);
    const [showOverlay, setShowOverlay] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [bookedCreatives, setBookedCreatives] = useState([]);
    const [loading, setLoading] = useState(true);

    const intervalRef = useRef(null);
    const progressRef = useRef(null);

    // Load loop data and booked campaigns
    useEffect(() => {
        loadData();
    }, [searchParams]);

    const loadData = async () => {
        try {
            setLoading(true);
            const screenId = searchParams.get('screen');
            const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
            const hour = parseInt(searchParams.get('hour') || new Date().getHours());

            // 1. Get campaigns for general demo content
            const allCampaigns = await apiService.getCampaigns();
            const activeCampaigns = allCampaigns.filter(c =>
                c.creative_url &&
                (c.status?.toLowerCase() === 'live' || c.status?.toLowerCase() === 'active' || c.status === 'APPROVED')
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

                // Fetch store and loop in parallel
                const storeId = targetScreen.store_id || targetScreen.storeId;
                const [storeData, loopData] = await Promise.all([
                    storeId ? apiService.getStore(storeId) : Promise.resolve(null),
                    apiService.getLoopByParams(targetScreen.id || targetScreen.screen_id, date, hour)
                ]);

                setStore(storeData);
                setLoop(loopData);
            }
        } catch (error) {
            console.error('Failed to load player data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Update current time
    useEffect(() => {
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timeInterval);
    }, []);

    // Handle slot progression
    useEffect(() => {
        if (!isPlaying || loading) return;

        // Progress animation within slot
        progressRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) return 0;
                return prev + (100 / (SLOT_DURATION / 100));
            });
        }, 100);

        // Slot transition
        intervalRef.current = setInterval(() => {
            setCurrentSlotIndex(prev => (prev + 1) % TOTAL_SLOTS);
            setProgress(0);
        }, SLOT_DURATION);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
        };
    }, [isPlaying, loading]);

    const slotContent = useMemo(() => {
        // First check if loop has specific booked content for this slot
        if (loop && loop.slots && loop.slots[currentSlotIndex]) {
            const slot = loop.slots[currentSlotIndex];
            if ((slot.status?.toLowerCase() === 'booked' || slot.status === 'BOOKED') && slot.creative_url) {
                return {
                    type: 'ad',
                    content: {
                        creative_url: slot.creative_url,
                        campaign_name: slot.campaign_name || 'Campaign Content',
                        advertiser_name: slot.advertiser_name || 'Verified Partner'
                    }
                };
            }
        }

        // Otherwise, if we have active campaigns across the network, show them as fallback demo
        if (bookedCreatives.length > 0) {
            const creative = bookedCreatives[currentSlotIndex % bookedCreatives.length];
            return {
                type: 'campaign',
                content: {
                    creative_url: creative.creative_url,
                    campaign_name: creative.name,
                    advertiser_name: creative.advertiser_name || 'Network Partner'
                }
            };
        }

        // Fall back to system demo content
        return {
            type: 'demo',
            content: DEMO_CONTENT[currentSlotIndex % DEMO_CONTENT.length]
        };
    }, [loop, currentSlotIndex, bookedCreatives]);



    const togglePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const goToSlot = useCallback((index) => {
        setCurrentSlotIndex(index);
        setProgress(0);
    }, []);



    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    if (loading) return (
        <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
            <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold tracking-widest text-primary animate-pulse">SYNCHRONIZING BROADCAST...</p>
        </div>
    );

    return (
        <div
            className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden"
            onMouseMove={() => setShowOverlay(true)}
            onMouseLeave={() => setShowOverlay(false)}
        >
            {/* Main Display Area */}
            <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] bg-slate-900">

                {/* Content Display */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {slotContent.type === 'ad' || slotContent.type === 'campaign' ? (
                        <div className="w-full h-full relative">
                            <img
                                key={currentSlotIndex}
                                src={slotContent.content.creative_url}
                                alt="Advertisement"
                                className="w-full h-full object-cover animate-in fade-in duration-500"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                            {/* Campaign info overlay */}
                            <div className="absolute bottom-20 right-4 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-white text-sm max-w-xs shadow-2xl border border-white/10">
                                <p className="font-bold truncate">{slotContent.content.campaign_name}</p>
                                <p className="text-white/60 text-xs">{slotContent.content.advertiser_name}</p>
                            </div>
                        </div>
                    ) : (
                        <div key={currentSlotIndex} className={`w-full h-full bg-gradient-to-br ${slotContent.content.color} flex flex-col items-center justify-center animate-in fade-in duration-500`}>
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

                {/* Slot Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 overflow-hidden">
                    <div
                        className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Slot Indicator Grid */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                    {Array.from({ length: TOTAL_SLOTS }).map((_, index) => {
                        const isBooked = loop?.slots?.[index]?.status?.toLowerCase() === 'booked' || loop?.slots?.[index]?.status === 'BOOKED';
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

                {/* Top Info Bar (shown on hover) */}
                <div
                    className={`
                        absolute top-0 left-0 right-0 p-6 
                        bg-gradient-to-b from-black/90 to-transparent
                        transition-all duration-500 transform
                        ${showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
                    `}
                >
                    <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-xl">tv</span>
                                </div>
                                <span className="text-xl font-black tracking-tight">
                                    {(screen?.name || screen?.screen_id || 'DEMO SCREEN').toUpperCase()}
                                </span>
                            </div>
                            {store && (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5">
                                    <span className="material-symbols-outlined text-sm text-primary">storefront</span>
                                    <span className="text-sm font-bold">{store.name}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Current Time</p>
                                <p className="font-mono text-xl font-bold">{formatTime(currentTime)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Loop Status</p>
                                <p className="font-mono text-xl font-bold text-primary">
                                    {String(Math.floor((currentSlotIndex * 5 + (progress / 100) * 5))).padStart(2, '0')}s / 60s
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Controls (shown on hover) */}
                <div
                    className={`
                        absolute bottom-16 left-0 right-0 px-4
                        flex items-center justify-center gap-6
                        transition-all duration-500 transform
                        ${showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                    `}
                >
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

                {/* Slot Counter Badge */}
                <div className="absolute top-8 right-8 px-6 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white shadow-2xl">
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">Active Slot</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-primary">{currentSlotIndex + 1}</span>
                        <span className="text-white/40 text-xl font-bold"> / {TOTAL_SLOTS}</span>
                    </div>
                </div>

                {/* Exit Button */}
                <a
                    href="/dashboard"
                    className={`
                        absolute top-8 left-8 size-12 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 
                        text-white hover:bg-primary transition-all duration-500 flex items-center justify-center
                        transform ${showOverlay ? 'opacity-100' : 'opacity-0 -translate-x-4'}
                    `}
                >
                    <span className="material-symbols-outlined">close</span>
                </a>
            </div>

            {/* 16:9 Aspect Ratio Letterbox */}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: scale(1.05) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-in {
                    animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
}

export default LoopDemoPlayer;

