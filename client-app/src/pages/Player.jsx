import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiService from '../services/ApiService'; // Ensure this path is correct if ApiService is there
import { API_URL } from '../config.js';

function Player() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Cascading selection state
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);
    const [selectedStore, setSelectedStore] = useState('');
    const [selectedScreen, setSelectedScreen] = useState(searchParams.get('screen_id') || '');
    const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);

    const [status, setStatus] = useState('idle');
    const [playlist, setPlaylist] = useState([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);

    // Initial load: fetch stores
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await apiService.getStores();
                setStores(res.stores || res || []);
            } catch (err) {
                console.error('Failed to fetch stores', err);
            }
        };
        fetchStores();
    }, []);

    // When store changes, fetch screens
    useEffect(() => {
        if (!selectedStore) {
            setScreens([]);
            return;
        }
        const fetchScreens = async () => {
            try {
                const res = await apiService.getScreens({ storeId: selectedStore });
                setScreens(res.screens || res || []);
            } catch (err) {
                console.error('Failed to fetch screens', err);
            }
        };
        fetchScreens();
    }, [selectedStore]);

    const handlePlay = async () => {
        if (!selectedScreen || !selectedDate) return;

        // Update URL
        setSearchParams({ screen_id: selectedScreen, date: selectedDate });
        setStatus('loading_playlist');

        try {
            // Fetch multiple loops for the day to get a full schedule of slots for this specific screen+date
            const res = await fetch(`${API_URL}/api/loops?screenId=${selectedScreen}&date=${selectedDate}`);
            const data = await res.json();

            let allSlots = [];
            if (data.loops && data.loops.length > 0) {
                // Combine all slots from all hours if needed, or simply map the loops
                // The instructions say "loop fetch by screenid + date; slot playback order"
                data.loops.forEach(loop => {
                    if (loop.slots && Array.isArray(loop.slots)) {
                        allSlots = allSlots.concat(loop.slots.filter(s => s && s.creative_url));
                    }
                });
            } else if (Array.isArray(data) && data.length > 0) {
                data.forEach(loop => {
                    if (loop.slots && Array.isArray(loop.slots)) {
                        allSlots = allSlots.concat(loop.slots.filter(s => s && s.creative_url));
                    }
                });
            }

            if (allSlots.length > 0) {
                // Deduplicate consecutive or construct the playlist
                setPlaylist(allSlots.map(s => ({
                    id: s.id || s.asset_id,
                    url: s.creative_url,
                    title: s.campaign_name || 'Ad',
                    duration: 5 // Default slot duration 5s
                })));
                setCurrentAdIndex(0);
                setStatus('playing');
            } else {
                setStatus('no_content');
            }
        } catch (e) {
            console.error('Playlist fetch failed', e);
            setStatus('error');
        }
    };

    // Auto-fetch if params are present
    useEffect(() => {
        if (selectedScreen && selectedDate && status === 'idle') {
            handlePlay();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedScreen, selectedDate, status]);

    // Playback Loop
    useEffect(() => {
        if (status !== 'playing' || !playlist || playlist.length === 0) return;

        const currentAd = playlist[currentAdIndex];
        const duration = (currentAd.duration || 5) * 1000;

        const timer = setTimeout(() => {
            setCurrentAdIndex((prev) => (prev + 1) % playlist.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [status, playlist, currentAdIndex]);

    const activeAd = playlist ? playlist[currentAdIndex] : null;

    if (status === 'playing' && activeAd) {
        return (
            <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black', overflow: 'hidden', position: 'relative' }}>
                <img
                    key={currentAdIndex} // Force re-render animation
                    src={activeAd.url}
                    alt={activeAd.title}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Exit back to selection */}
                <button
                    onClick={() => setStatus('idle')}
                    style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 10 }}
                >
                    Back to Setup
                </button>

                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 5, fontSize: 10, zIndex: 10 }}>
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
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            fontFamily: 'sans-serif'
        }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>SoftoMedia Player setup</h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#111', padding: '2rem', borderRadius: '8px', border: '1px solid #333' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <label style={{ color: '#aaa', marginBottom: '0.5rem' }}>1. Select Store</label>
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                        >
                            <option value="">-- Choose Store --</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <label style={{ color: '#aaa', marginBottom: '0.5rem' }}>2. Select Screen</label>
                        <select
                            value={selectedScreen}
                            onChange={(e) => setSelectedScreen(e.target.value)}
                            disabled={!selectedStore && !selectedScreen}
                            style={{ padding: '0.75rem', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                        >
                            <option value="">-- Choose Screen --</option>
                            {screens.map(s => <option key={s.id || s.screen_id} value={s.id || s.screen_id}>{s.name || s.screen_id}</option>)}
                            {!screens.find(s => (s.id || s.screen_id) === selectedScreen) && selectedScreen && (
                                <option value={selectedScreen}>{selectedScreen} (From URL)</option>
                            )}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <label style={{ color: '#aaa', marginBottom: '0.5rem' }}>3. Select Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444', colorScheme: 'dark' }}
                        />
                    </div>

                    <button
                        onClick={handlePlay}
                        disabled={!selectedScreen || !selectedDate}
                        style={{ marginTop: '1rem', padding: '1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}
                    >
                        Start Playback
                    </button>

                    <div style={{ marginTop: '1rem' }}>
                        {status === 'loading_playlist' && <span style={{ color: '#60a5fa' }}>Loading Content...</span>}
                        {status === 'no_content' && <span style={{ color: '#9ca3af' }}>No ads scheduled for this date/screen.</span>}
                        {status === 'error' && <span style={{ color: '#ef4444' }}>Error occurred.</span>}
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Player;
