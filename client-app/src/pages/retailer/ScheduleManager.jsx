import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import LoopPreview from '../../components/LoopPreview';
import { API_URL } from '../../config';

function ScheduleManager() {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [locations, setLocations] = useState([]);
    const [hourlyLoop, setHourlyLoop] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/locations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLocations(data);
                if (data.length > 0) {
                    setSelectedLocation(data[0]);
                    fetchLoop(data[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch locations', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLoop = async (locId) => {
        // Since we don't have a dedicated "preview" API yet, 
        // we hit the playlist endpoint for a screen in that location for MVP simulation
        try {
            const loc = locations.find(l => l.id === locId) || selectedLocation;
            if (!loc || !loc.screen_ids || loc.screen_ids.length === 0) return;

            const res = await fetch(`${API_URL}/api/playlist/${loc.screen_ids[0]}`);
            if (res.ok) {
                const data = await res.json();
                setHourlyLoop(data.playlist);
            }
        } catch (error) {
            console.error('Failed to fetch loop preview', error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Schedule Manager</h1>
                    <p className="text-slate-500 dark:text-slate-400">Validate D-1 hourly loops for your store locations</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">done_all</span>
                        Bulk Approve All
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Location Sidebar */}
                <aside className="lg:col-span-1 space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Locations</h3>
                    {locations.map(loc => (
                        <div
                            key={loc.id}
                            onClick={() => {
                                setSelectedLocation(loc);
                                fetchLoop(loc.id);
                            }}
                            className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedLocation?.id === loc.id ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                        >
                            <p className="font-bold text-slate-900 dark:text-white">{loc.name}</p>
                            <p className="text-xs text-slate-500">{loc.screen_ids?.length || 0} Screens Active</p>
                        </div>
                    ))}
                </aside>

                {/* Schedule Content */}
                <main className="lg:col-span-3 space-y-8">
                    <GlassCard>
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold">Hourly Loop: 08:00 - 09:00</h2>
                                <p className="text-sm text-slate-500">Validation window for tomorrow Oct 12, 2023</p>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold ring-1 ring-inset ring-amber-500/20 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                D-1 Generating
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">view_timeline</span>
                            Loop Breakdown
                        </h3>
                        <LoopPreview slots={hourlyLoop} />
                    </GlassCard>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ad Frequency</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">60x / Hour</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Weight</p>
                            <p className="text-2xl font-black text-primary">8.33%</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Safety Lock</p>
                            <p className="text-2xl font-black text-emerald-500">Enabled</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default ScheduleManager;
