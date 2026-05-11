import { useState, useEffect, useRef } from 'react';
import GlassCard from '../../components/GlassCard';
import { MAPS_API_KEY } from '../../config';
import apiService from '../../services/ApiService';

function NetworkMap() {
    const [selectedRegion, setSelectedRegion] = useState('downtown');
    const [screens, setScreens] = useState([]);
    const [mapError, setMapError] = useState('');
    const mapRef = useRef(null);

    useEffect(() => {
        const fetchScreens = async () => {
            try {
                const res = await apiService.getScreens();
                setScreens(res.screens || res || []);
            } catch (err) {
                console.error("Failed to fetch screens for map", err);
            }
        };
        fetchScreens();
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        let map;
        const initMap = () => {
            if (!window.google) return;
            map = new window.google.maps.Map(mapRef.current, {
                center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
                zoom: 12,
                styles: [{ "elementType": "geometry", "stylers": [{ "color": "#212121" }] }, { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }, { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }, { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] }, { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] }, { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }, { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] }, { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }, { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] }, { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] }, { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] }, { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] }, { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] }, { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] }, { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] }, { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] }, { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] }, { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }, { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }, { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }]
            });

            screens.forEach(screen => {
                const lat = parseFloat(screen.latitude || screen.store?.latitude || (40.7128 + (Math.random() - 0.5) * 0.1));
                const lng = parseFloat(screen.longitude || screen.store?.longitude || (-74.0060 + (Math.random() - 0.5) * 0.1));

                new window.google.maps.Marker({
                    position: { lat, lng },
                    map,
                    title: screen.name || `Screen ${screen.id}`,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: screen.status === 'online' ? '#10b981' : '#ef4444',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                    }
                });
            });
        };

        if (window.google && window.google.maps) {
            initMap();
        } else if (MAPS_API_KEY) {
            const scriptId = 'google-maps-script';
            if (!document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
                script.async = true;
                script.onload = initMap;
                script.onerror = () => setMapError('Failed to load Google Maps script. Check API key.');
                document.head.appendChild(script);
            } else {
                window[scriptId + '-onload'] = initMap;
            }
        } else {
            setMapError('No MAPS_API_KEY provided in config.');
        }
    }, [screens]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Network Map</h1>
                    <p className="text-slate-500 dark:text-slate-400">Geospatial view of active retail screens</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    >
                        <option value="downtown">Downtown District</option>
                        <option value="uptown">Uptown Mall</option>
                        <option value="suburbs">Suburban Centers</option>
                    </select>
                </div>
            </div>

            <GlassCard className="p-0 relative overflow-hidden bg-slate-100 dark:bg-slate-800" style={{ height: '600px' }}>
                {mapError ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                        <span className="material-symbols-outlined text-6xl mb-4 text-slate-400">map</span>
                        <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300">Map Unavailable</h3>
                        <p className="max-w-md mx-auto mt-2 text-slate-500">{mapError}</p>
                    </div>
                ) : (
                    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                )}
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard>
                    <h3 className="font-bold text-lg mb-2">Region Stats</h3>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{screens.length || 124}</div>
                    <p className="text-sm text-slate-500">Total Screens</p>
                </GlassCard>
                <GlassCard>
                    <h3 className="font-bold text-lg mb-2">Health</h3>
                    <div className="text-3xl font-bold text-emerald-500">
                        {screens.length > 0 ? Math.round((screens.filter(s => s.status === 'online').length / screens.length) * 100) : 98}%
                    </div>
                    <p className="text-sm text-slate-500">Online Rate</p>
                </GlassCard>
                <GlassCard>
                    <h3 className="font-bold text-lg mb-2">Impressions</h3>
                    <div className="text-3xl font-bold text-primary">45.2K</div>
                    <p className="text-sm text-slate-500">Daily Views</p>
                </GlassCard>
            </div>
        </div>
    );
}

export default NetworkMap;
