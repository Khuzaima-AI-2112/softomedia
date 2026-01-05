/**
 * LoopDemoPlayer - Standalone 12-slot × 5-second loop demonstration
 * Full-screen player for demonstrating the hourly loop broadcast model
 * 
 * Shows booked campaign creatives from localStorage when available,
 * otherwise displays demo content.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import localStorageService from '../services/LocalStorageService';

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

    const intervalRef = useRef(null);
    const progressRef = useRef(null);

    // Load loop data and booked campaigns
    useEffect(() => {
        localStorageService.init();

        const screenId = searchParams.get('screen');
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const hour = parseInt(searchParams.get('hour') || new Date().getHours());

        // Load all campaigns with creatives (for demo mode)
        const campaigns = localStorageService.getCampaigns();
        const creativesFromCampaigns = campaigns
            .filter(c => c.creativeUrl && c.status !== 'ended')
            .map(c => ({
                campaignId: c.id,
                advertiserId: c.advertiserId,
                campaignName: c.name,
                creativeUrl: c.creativeUrl,
                advertiser: localStorageService.getAdvertiser(c.advertiserId)
            }));
        setBookedCreatives(creativesFromCampaigns);

        if (screenId) {
            const screenData = localStorageService.getScreen(screenId);
            setScreen(screenData);

            if (screenData) {
                const storeData = localStorageService.getStore(screenData.storeId);
                setStore(storeData);

                const loopData = localStorageService.getLoopByParams(screenId, date, hour);
                setLoop(loopData);
            }
        } else {
            // Get first available screen for demo
            const screens = localStorageService.getScreens();
            if (screens.length > 0) {
                const firstScreen = screens[0];
                setScreen(firstScreen);

                const storeData = localStorageService.getStore(firstScreen.storeId);
                setStore(storeData);

                const loopData = localStorageService.getLoopByParams(
                    firstScreen.id,
                    date,
                    hour
                );
                setLoop(loopData);
            }
        }
    }, [searchParams]);

    // Update current time
    useEffect(() => {
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timeInterval);
    }, []);

    // Handle slot progression
    useEffect(() => {
        if (!isPlaying) return;

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
            clearInterval(intervalRef.current);
            clearInterval(progressRef.current);
        };
    }, [isPlaying]);

    const togglePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const goToSlot = useCallback((index) => {
        setCurrentSlotIndex(index);
        setProgress(0);
    }, []);

    const getCurrentSlotContent = () => {
        // First check if loop has booked content for this slot
        if (loop && loop.slots && loop.slots[currentSlotIndex]) {
            const slot = loop.slots[currentSlotIndex];
            if (slot.status === 'booked' && slot.creativeUrl) {
                const campaign = localStorageService.getCampaign(slot.campaignId);
                const advertiser = localStorageService.getAdvertiser(slot.advertiserId);
                return {
                    type: 'ad',
                    content: {
                        ...slot,
                        campaignName: campaign?.name || 'Campaign',
                        advertiserName: advertiser?.name || 'Advertiser'
                    }
                };
            }
        }

        // Otherwise, if we have booked creatives from campaigns, show them
        if (bookedCreatives.length > 0) {
            const creative = bookedCreatives[currentSlotIndex % bookedCreatives.length];
            return {
                type: 'campaign',
                content: creative
            };
        }

        // Fall back to demo content
        return {
            type: 'demo',
            content: DEMO_CONTENT[currentSlotIndex % DEMO_CONTENT.length]
        };
    };

    const slotContent = getCurrentSlotContent();

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

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
                                src={slotContent.content.creativeUrl}
                                alt="Advertisement"
                                className="w-full h-full object-cover animate-in fade-in duration-500"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                            {/* Campaign info overlay */}
                            <div className="absolute bottom-20 right-4 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-white text-sm max-w-xs">
                                <p className="font-bold truncate">{slotContent.content.campaignName || slotContent.content.advertiser?.name}</p>
                                <p className="text-white/60 text-xs">Sponsored</p>
                            </div>
                        </div>
                    ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${slotContent.content.color} flex flex-col items-center justify-center animate-in fade-in duration-500`}>
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
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                    <div
                        className="h-full bg-white transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Slot Indicator Grid */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {Array.from({ length: TOTAL_SLOTS }).map((_, index) => {
                        const hasContent = loop?.slots?.[index]?.status === 'booked' ||
                            (bookedCreatives.length > 0 && index < bookedCreatives.length);
                        return (
                            <button
                                key={index}
                                onClick={() => goToSlot(index)}
                                className={`
                                    w-8 h-2 rounded-full transition-all duration-300
                                    ${index === currentSlotIndex
                                        ? 'bg-white scale-110'
                                        : hasContent
                                            ? 'bg-primary/80'
                                            : index < currentSlotIndex
                                                ? 'bg-white/50'
                                                : 'bg-white/20'}
                                    hover:bg-white/80
                                `}
                                title={`Slot ${index + 1}${hasContent ? ' (Booked)' : ''}`}
                            />
                        );
                    })}
                </div>

                {/* Top Info Bar (shown on hover) */}
                <div
                    className={`
                        absolute top-0 left-0 right-0 p-4 
                        bg-gradient-to-b from-black/80 to-transparent
                        transition-opacity duration-300
                        ${showOverlay ? 'opacity-100' : 'opacity-0'}
                    `}
                >
                    <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">tv</span>
                                <span className="font-medium">
                                    {screen?.name || 'Demo Screen'}
                                </span>
                            </div>
                            {store && (
                                <div className="flex items-center gap-2 text-white/70">
                                    <span className="material-symbols-outlined text-sm">storefront</span>
                                    <span className="text-sm">{store.name}</span>
                                </div>
                            )}
                            {bookedCreatives.length > 0 && (
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    <span className="text-sm">{bookedCreatives.length} Campaign{bookedCreatives.length > 1 ? 's' : ''} Active</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="text-xs text-white/60 uppercase tracking-wider">Current Time</p>
                                <p className="font-mono text-lg">{formatTime(currentTime)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-white/60 uppercase tracking-wider">Loop Progress</p>
                                <p className="font-mono text-lg">
                                    {String(Math.floor((currentSlotIndex * 5 + (progress / 100) * 5))).padStart(2, '0')}s / 60s
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Controls (shown on hover) */}
                <div
                    className={`
                        absolute bottom-12 left-0 right-0 px-4
                        flex items-center justify-center gap-4
                        transition-opacity duration-300
                        ${showOverlay ? 'opacity-100' : 'opacity-0'}
                    `}
                >
                    <button
                        onClick={() => goToSlot((currentSlotIndex - 1 + TOTAL_SLOTS) % TOTAL_SLOTS)}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">skip_previous</span>
                    </button>
                    <button
                        onClick={togglePlayPause}
                        className="p-4 rounded-full bg-white text-black hover:bg-white/90 transition-colors shadow-lg"
                    >
                        <span className="material-symbols-outlined text-3xl">
                            {isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                    </button>
                    <button
                        onClick={() => goToSlot((currentSlotIndex + 1) % TOTAL_SLOTS)}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">skip_next</span>
                    </button>
                </div>

                {/* Slot Counter Badge */}
                <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white font-bold">
                    <span className="text-2xl">{currentSlotIndex + 1}</span>
                    <span className="text-white/60 text-lg"> / {TOTAL_SLOTS}</span>
                </div>

                {/* Exit Button */}
                <a
                    href="/dashboard"
                    className={`
                        absolute top-4 left-4 p-2 rounded-full bg-black/50 backdrop-blur-sm 
                        text-white hover:bg-white/20 transition-all duration-300
                        ${showOverlay ? 'opacity-100' : 'opacity-0'}
                    `}
                >
                    <span className="material-symbols-outlined">close</span>
                </a>
            </div>

            {/* 16:9 Aspect Ratio Letterbox */}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: scale(1.05); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-in {
                    animation: slideIn 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
}

export default LoopDemoPlayer;

