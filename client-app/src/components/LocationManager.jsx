import { useEffect, useState } from 'react';
import GlassCard from './GlassCard';
import apiService from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function LocationManager() {
    const { user } = useAuth();
    const [stores, setStores] = useState([]);
    const [locations, setLocations] = useState([]);
    const [newStore, setNewStore] = useState({ name: '', time_zone: browserTimeZone });
    const [newLocation, setNewLocation] = useState({ name: '', store_id: '' });
    const [showStoreForm, setShowStoreForm] = useState(false);
    const [showLocationForm, setShowLocationForm] = useState(false);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadManagedRecords = async () => {
        setLoading(true);
        try {
            const [storeData, locationData] = await Promise.all([
                apiService.getStores(),
                apiService.getLocations(),
            ]);
            setStores(storeData);
            setLocations(locationData);
            setNewLocation(current => ({
                ...current,
                store_id: current.store_id || storeData[0]?.id || '',
            }));
        } catch (error) {
            setMessage({ type: 'error', text: 'Unable to load your stores and locations.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadManagedRecords();
    }, []);

    const addStore = async (event) => {
        event.preventDefault();
        const retailerId = user?.linked_entity_id || user?.linkedentityid || user?.retailer_id;
        if (!retailerId) {
            setMessage({ type: 'error', text: 'Your account is not linked to a retailer.' });
            return;
        }

        try {
            const store = await apiService.createStore({ ...newStore, retailer_id: retailerId });
            setStores(current => [...current, store]);
            setNewLocation(current => ({ ...current, store_id: current.store_id || store.id }));
            setNewStore({ name: '', time_zone: browserTimeZone });
            setShowStoreForm(false);
            setMessage({ type: 'success', text: `${store.name} was created with 08:00–22:00 hours every day.` });
        } catch (error) {
            setMessage({ type: 'error', text: error?.response?.data?.error || 'Unable to create the store.' });
        }
    };

    const addLocation = async (event) => {
        event.preventDefault();
        try {
            const location = await apiService.createLocation(newLocation);
            setLocations(current => [...current, location]);
            setNewLocation(current => ({ ...current, name: '' }));
            setShowLocationForm(false);
            setMessage({ type: 'success', text: `${location.name} was added to the selected store.` });
        } catch (error) {
            setMessage({ type: 'error', text: error?.response?.data?.error || 'Unable to create the location.' });
        }
    };

    if (loading) return <div className="animate-pulse h-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />;

    return (
        <section data-testid="retailer-store-manager" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Stores and Locations</h2>
                    <p className="text-sm text-slate-500">Store time zones determine schedule and approval timing.</p>
                </div>
                <div className="flex gap-2">
                    <button data-testid="add-store-button" onClick={() => setShowStoreForm(current => !current)} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">
                        {showStoreForm ? 'Cancel' : 'Add Store'}
                    </button>
                    <button data-testid="add-location-button" onClick={() => setShowLocationForm(current => !current)} disabled={!stores.length} className="px-3 py-2 rounded-lg border border-primary text-primary font-bold text-sm disabled:opacity-50">
                        {showLocationForm ? 'Cancel' : 'Add Location'}
                    </button>
                </div>
            </div>

            {message && <p role="status" className={message.type === 'error' ? 'text-sm text-red-600' : 'text-sm text-emerald-600'}>{message.text}</p>}

            {showStoreForm && (
                <GlassCard>
                    <form data-testid="add-store-form" onSubmit={addStore} className="grid gap-3 md:grid-cols-3 md:items-end">
                        <label className="text-sm font-medium">Store name
                            <input data-testid="store-name-input" required value={newStore.name} onChange={event => setNewStore(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded border p-2 text-slate-900" />
                        </label>
                        <label className="text-sm font-medium">IANA time zone
                            <input data-testid="store-time-zone-input" required value={newStore.time_zone} onChange={event => setNewStore(current => ({ ...current, time_zone: event.target.value }))} className="mt-1 w-full rounded border p-2 text-slate-900" placeholder="America/Toronto" />
                        </label>
                        <button type="submit" className="rounded bg-primary px-4 py-2 font-bold text-white">Create Store</button>
                    </form>
                </GlassCard>
            )}

            {showLocationForm && (
                <GlassCard>
                    <form data-testid="add-location-form" onSubmit={addLocation} className="grid gap-3 md:grid-cols-3 md:items-end">
                        <label className="text-sm font-medium">Location name
                            <input data-testid="location-name-input" required value={newLocation.name} onChange={event => setNewLocation(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded border p-2 text-slate-900" />
                        </label>
                        <label className="text-sm font-medium">Store
                            <select data-testid="location-store-select" value={newLocation.store_id} onChange={event => setNewLocation(current => ({ ...current, store_id: event.target.value }))} className="mt-1 w-full rounded border p-2 text-slate-900">
                                {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                            </select>
                        </label>
                        <button type="submit" className="rounded bg-primary px-4 py-2 font-bold text-white">Create Location</button>
                    </form>
                </GlassCard>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {stores.map(store => {
                    const storeLocations = locations.filter(location => location.store_id === store.id);
                    return (
                        <GlassCard key={store.id} data-testid={`store-card-${store.id}`}>
                            <h3 className="font-bold text-slate-900 dark:text-white">{store.name}</h3>
                            <p data-testid={`store-time-zone-${store.id}`} className="mt-1 text-sm text-slate-500">Time zone: {store.time_zone}</p>
                            <p className="mt-1 text-xs text-slate-500">Standard hours: 08:00–22:00 daily unless changed.</p>
                            <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                {storeLocations.map(location => <li key={location.id}>• {location.name}</li>)}
                                {!storeLocations.length && <li className="text-slate-500">No locations configured.</li>}
                            </ul>
                        </GlassCard>
                    );
                })}
            </div>
        </section>
    );
}

export default LocationManager;
