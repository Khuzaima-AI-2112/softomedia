import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';

function NetworkMap() {
    const [selectedRegion, setSelectedRegion] = useState('downtown');
    const [screens, setScreens] = useState([]);
    const [loadingScreens, setLoadingScreens] = useState(true);
    const [screenError, setScreenError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoadingScreens(true);
                const data = await apiService.getScreens();
                if (!cancelled) setScreens(data || []);
            } catch (err) {
                if (!cancelled) setScreenError('Failed to load screen data.');
                console.error('NetworkMap screen fetch error:', err);
            } finally {
                if (!cancelled) setLoadingScreens(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const totalScreens = screens.length;
    const onlineScreens = screens.filter(s => s.status === 'online').length;
    const onlineRate = totalScreens > 0
        ? ((onlineScreens / totalScreens) * 100).toFixed(1)
        : '0.0';
    // Daily impressions: sum play_count across all screens if available,
    // otherwise fall back to a dash until telemetry aggregation is wired.
    const dailyImpressions = screens.reduce((acc, s) => acc + (s.play_count || 0), 0);
    const dailyImpressionsLabel = dailyImpressions > 0
        ? dailyImpressions >= 1000
            ? (dailyImpressions / 1000).toFixed(1) + 'K'
            : String(dailyImpressions)
        : '—';

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

            {screenError && (
                <div
                    data-testid="network-map-error"
                    className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg"
                >
                    {screenError}
                </div>
            )}

            <GlassCard data-testid="network-map" className="h-[600px] relative overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                {/* Placeholder for actual Map implementation (e.g. Google Maps or Leaflet) */}
                <div className="text-center p-8 opacity-60">
                    <span className="material-symbols-outlined text-6xl mb-4 text-slate-400">map</span>
                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300">Map Visualization</h3>
                    <p className="max-w-md mx-auto mt-2 text-slate-500">
                        Interactive map view enabled. Showing{' '}
                        {loadingScreens ? '…' : onlineScreens} active screens in {selectedRegion}.
                    </p>

                    {/* Mock Map Points */}
                    <div className="absolute top-1/4 left-1/4 animate-bounce duration-1000">
                        <span className="material-symbols-outlined text-red-500 text-3xl drop-shadow-md cursor-pointer hover:scale-125 transition-transform" title="Retailer A - Offline">location_on</span>
                    </div>
                    <div className="absolute top-1/2 left-1/2 animate-bounce duration-[2000ms]">
                        <span className="material-symbols-outlined text-emerald-500 text-3xl drop-shadow-md cursor-pointer hover:scale-125 transition-transform" title="Retailer B - Online">location_on</span>
                    </div>
                    <div className="absolute bottom-1/3 right-1/4 animate-bounce duration-[1500ms]">
                        <span className="material-symbols-outlined text-emerald-500 text-3xl drop-shadow-md cursor-pointer hover:scale-125 transition-transform" title="Retailer C - Online">location_on</span>
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard>
                    <h3 className="font-bold text-lg mb-2">Region Stats</h3>
                    {loadingScreens ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    ) : (
                        <div
                            data-testid="stat-total-screens"
                            className="text-3xl font-bold text-slate-900 dark:text-white"
                        >
                            {totalScreens}
                        </div>
                    )}
                    <p className="text-sm text-slate-500">Total Screens</p>
                </GlassCard>

                <GlassCard>
                    <h3 className="font-bold text-lg mb-2">Health</h3>
                    {loadingScreens ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                    ) : (
                        <div
                            data-testid="stat-online-rate"
                            className="text-3xl font-bold text-emerald-500"
                        >
                            {onlineRate}%
                        </div>
                    )}
                    <p className="text-sm text-slate-500">Online Rate</p>
                </GlassCard>

                <GlassCard>
                    <h3 className="font-bold text-lg mb-2">Impressions</h3>
                    {loadingScreens ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    ) : (
                        <div
                            data-testid="stat-daily-impressions"
                            className="text-3xl font-bold text-primary"
                        >
                            {dailyImpressionsLabel}
                        </div>
                    )}
                    <p className="text-sm text-slate-500">Daily Views</p>
                </GlassCard>
            </div>
        </div>
    );
}

export default NetworkMap;
