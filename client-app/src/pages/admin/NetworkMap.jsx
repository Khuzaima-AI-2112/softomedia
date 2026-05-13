import { useState, useEffect, useRef } from 'react';
import { Map, Monitor, Wifi, TrendingUp } from 'lucide-react';
import { MAPS_API_KEY } from '../../config';
import apiService from '../../services/ApiService';
import '../../design-tokens.css';

function NetworkMap() {
    const [selectedRegion, setSelectedRegion] = useState('downtown');
    const [screens, setScreens]               = useState([]);
    const [mapError, setMapError]             = useState('');
    const [selectedScreen, setSelectedScreen] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        const fetchScreens = async () => {
            try {
                const res = await apiService.getScreens();
                setScreens(res.screens || res || []);
            } catch (err) { console.error('Failed to fetch screens for map', err); }
        };
        fetchScreens();
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        let map;
        const initMap = () => {
            if (!window.google) return;
            map = new window.google.maps.Map(mapRef.current, {
                center: { lat: 40.7128, lng: -74.0060 },
                zoom: 12,
                styles: [{"elementType":"geometry","stylers":[{"color":"#212121"}]},{"elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#212121"}]},{"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#2c2c2c"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#3c3c3c"}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#000000"}]}],
            });
            screens.forEach(screen => {
                const lat = parseFloat(screen.latitude  || screen.store?.latitude  || (40.7128 + (Math.random() - 0.5) * 0.1));
                const lng = parseFloat(screen.longitude || screen.store?.longitude || (-74.0060 + (Math.random() - 0.5) * 0.1));
                const marker = new window.google.maps.Marker({
                    position: { lat, lng }, map,
                    title: screen.name || `Screen ${screen.id}`,
                    icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: screen.status === 'online' ? '#10b981' : '#ef4444', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
                });
                marker.addListener('click', () => setSelectedScreen(screen));
            });
        };
        if (window.google?.maps) { initMap(); }
        else if (MAPS_API_KEY) {
            const id = 'google-maps-script';
            if (!document.getElementById(id)) {
                const s = document.createElement('script');
                s.id = id; s.async = true;
                s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
                s.onload = initMap;
                s.onerror = () => setMapError('Failed to load Google Maps. Check API key.');
                document.head.appendChild(s);
            }
        } else { setMapError('No MAPS_API_KEY provided in config.'); }
    }, [screens]);

    const onlineCount = screens.filter(s => s.status === 'online').length;
    const healthPct   = screens.length > 0 ? Math.round((onlineCount / screens.length) * 100) : 98;

    const kpis = [
        { label: 'Total Screens', value: screens.length || 124, color: 'var(--color-text-primary)', icon: <Monitor size={16} />, iconColor: 'var(--color-primary)', iconBg: 'rgba(99,102,241,0.1)' },
        { label: 'Online Rate',   value: `${healthPct}%`,       color: 'var(--color-success)',      icon: <Wifi size={16} />,    iconColor: 'var(--color-success)', iconBg: 'var(--color-success-light)' },
        { label: 'Daily Views',   value: '45.2K',               color: 'var(--color-primary)',      icon: <TrendingUp size={16} />, iconColor: 'var(--color-primary)', iconBg: 'rgba(99,102,241,0.1)' },
    ];

    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5)',
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Network Map</h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>Geospatial view of active retail screens</p>
                </div>
                <select
                    value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
                    style={{
                        padding: 'var(--space-2) var(--space-3)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        backgroundColor: 'var(--color-bg-card)',
                        color: 'var(--color-text-primary)',
                        outline: 'none', fontFamily: 'var(--font-body)',
                    }}
                >
                    <option value="downtown">Downtown District</option>
                    <option value="uptown">Uptown Mall</option>
                    <option value="suburbs">Suburban Centers</option>
                </select>
            </div>

            {/* Map container */}
            <div style={{ ...card, padding: 0, position: 'relative', height: 560, overflow: 'hidden' }}>
                {mapError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 'var(--space-3)', opacity: 0.6 }}>
                        <Map size={48} style={{ color: 'var(--color-border)' }} />
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-secondary)', margin: 0 }}>Map Unavailable</h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>{mapError}</p>
                    </div>
                ) : (
                    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                )}

                {/* Screen detail overlay panel */}
                {selectedScreen && (
                    <div style={{
                        position: 'absolute', top: 16, right: 16,
                        width: 240,
                        backgroundColor: 'rgba(15,15,25,0.82)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        padding: 'var(--space-4)',
                        color: '#fff',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Monitor size={14} color="#818cf8" />
                                </div>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1.2 }}>
                                    {selectedScreen.name || `Screen ${selectedScreen.id}`}
                                </span>
                            </div>
                            <button onClick={() => setSelectedScreen(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2, lineHeight: 1, fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                                { label: 'Status', value: selectedScreen.status || 'Unknown' },
                                { label: 'Store',  value: selectedScreen.store?.name || selectedScreen.store_id || '—' },
                                { label: 'ID',     value: selectedScreen.id || selectedScreen.screen_id },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                                    <span style={{ color: '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)' }}>
                {kpis.map(k => (
                    <div key={k.label} style={card}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)' }}>{k.label}</span>
                            <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', backgroundColor: k.iconBg, color: k.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</span>
                        </div>
                        <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: k.color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NetworkMap;
