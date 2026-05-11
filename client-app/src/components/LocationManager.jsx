import { useState, useEffect } from 'react';
import GlassCard from './GlassCard';
import StatusBadge from './StatusBadge';
import apiService from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

function LocationManager() {
    const { user } = useAuth();
    const [locations, setLocations] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newLocation, setNewLocation] = useState({ name: '', store_profile: 'standard' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const data = await apiService.getStores();
            setLocations(data.stores || data || []);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            // Include user ID as retailer_id for store creation
            const payload = { ...newLocation, retailer_id: user?.linked_entity_id || 'retailer_demo' };
            const added = await apiService.createStore(payload);
            setLocations([...locations, added.store || added]);
            setIsAdding(false);
            setNewLocation({ name: '', store_profile: 'standard' });
        } catch (error) {
            console.error('Failed to add store:', error);
            alert('Failed to add store');
        }
    };

    if (loading) return <div className="animate-pulse h-40 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Store Locations</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">{isAdding ? 'close' : 'add_circle'}</span>
                    {isAdding ? 'Cancel' : 'Add Location'}
                </button>
            </div>

            {isAdding && (
                <GlassCard className="border-2 border-primary/20">
                    <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Store Name</label>
                            <input
                                type="text"
                                value={newLocation.name}
                                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="e.g. Downtown Flagship"
                                required
                            />
                        </div>
                        <div className="w-full md:w-48 space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profile</label>
                            <select
                                value={newLocation.store_profile}
                                onChange={(e) => setNewLocation({ ...newLocation, store_profile: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            >
                                <option value="standard">Standard</option>
                                <option value="flagship">Flagship</option>
                                <option value="compact">Compact</option>
                            </select>
                        </div>
                        <button type="submit" className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                            Save
                        </button>
                    </form>
                </GlassCard>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locations.length > 0 ? locations.map(loc => (
                    <GlassCard key={loc.id} className="group hover:border-primary/30 cursor-pointer transition-all">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined">location_on</span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{loc.name}</p>
                                    <p className="text-[11px] text-slate-500 uppercase font-bold tracking-tight">{loc.store_profile} Profile</p>
                                </div>
                            </div>
                            <StatusBadge status="Active" />
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">display_settings</span>
                                {loc.screen_count || 0} Screens Active
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">history</span>
                                {loc.last_sync || 'Never'}
                            </span>
                        </div>
                    </GlassCard>
                )) : (
                    <div className="col-span-2 text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">map</span>
                        <p className="text-slate-500">No locations configured yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LocationManager;
