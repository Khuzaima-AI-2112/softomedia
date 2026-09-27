import { useState, useEffect, useMemo } from 'react';
import apiService from '../../../services/ApiService';
import pricingService from '../../../services/PricingService';

// A Brand books whole Stores: the advertisement plays on every Screen in each
// Store it chooses, so each chosen Store contributes all its bookable Screens.
const Step1LocationScreen = ({ data, updateData, onNext }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRetailer, setSelectedRetailer] = useState('all');
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await apiService.getBookableInventory();
            const items = response.items || [];
            pricingService.configureBookableInventory(items);
            setRetailers([...new Map(items.map(item => [item.retailer.id, item.retailer])).values()]);
            setStores([...new Map(items.map(item => [item.store.id, {
                ...item.store,
                retailer_id: item.retailer.id,
                booking_price: item.booking_price,
            }])).values()]);
            setScreens(items.filter(item => item.availability.bookable).map(item => ({
                retailer_id: item.retailer.id,
                store_id: item.store.id,
                location_id: item.location.id,
                screen_id: item.screen.id,
            })));
        } catch (error) {
            console.error('[Diagnostic] Failed to load wizard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStores = useMemo(() => {
        return stores.filter(store => {
            const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (store.address && store.address.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesRetailer = selectedRetailer === 'all' || store.retailer_id === selectedRetailer;
            return matchesSearch && matchesRetailer;
        });
    }, [stores, searchQuery, selectedRetailer]);

    const getStoreScreens = (storeId) => screens.filter(screen => screen.store_id === storeId);

    const selectedStores = data.selectedStores || [];

    const handleStoreSelect = (storeId) => {
        const chosen = selectedStores.includes(storeId)
            ? selectedStores.filter(id => id !== storeId)
            : [...selectedStores, storeId];
        updateData({
            selectedStores: chosen,
            storeNames: Object.fromEntries(stores.map(store => [store.id, store.name])),
            selectedInventory: chosen.flatMap(getStoreScreens),
        });
    };

    const selectedScreenCount = selectedStores.flatMap(getStoreScreens).length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p>Loading stores...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 min-h-[500px] pb-24">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h2 className="text-xl font-bold">Select Stores</h2>
                <p className="text-sm text-slate-500">
                    Your advertisement plays on every Screen in each Store you choose.
                </p>
            </div>

            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">search</span>
                <input
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="Search stores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedRetailer('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedRetailer === 'all'
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600'
                        }`}
                >
                    All Retailers
                </button>
                {retailers.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setSelectedRetailer(r.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${selectedRetailer === r.id
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600'
                            }`}
                    >
                        <span>{r.logo}</span>
                        {r.name.split(' ')[0]}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredStores.map(store => {
                    const retailer = retailers.find(r => r.id === store.retailer_id);
                    const screenCount = getStoreScreens(store.id).length;
                    const isSelected = selectedStores.includes(store.id);

                    return (
                        <div
                            key={store.id}
                            onClick={() => handleStoreSelect(store.id)}
                            data-testid={`store-${store.name.toLowerCase().replace(/\s+/g, '-')}`}
                            className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${isSelected
                                ? 'bg-primary/5 border-primary shadow-md'
                                : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{retailer?.logo}</span>
                                    <h3 className="font-bold text-base">{store.name}</h3>
                                </div>
                                {isSelected && (
                                    <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-[14px]">check</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                                <span>{store.address}</span>
                                <span className="ml-auto text-xs font-bold text-emerald-600">
                                    ${Number(store.booking_price.base).toFixed(2)} {store.booking_price.unit}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700">
                                <span className="text-xs text-slate-500">{retailer?.name}</span>
                                <span className="text-xs font-bold px-2 py-1 rounded text-emerald-600 bg-emerald-100">
                                    {screenCount} {screenCount === 1 ? 'Screen' : 'Screens'}
                                </span>
                            </div>
                        </div>
                    );
                })}
                {filteredStores.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-400">
                        <p>No stores found</p>
                    </div>
                )}
            </div>

            {/* Sticky Footer */}
            <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#111722] border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
                <div className="max-w-[1440px] mx-auto px-10 py-4 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Selection</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-primary">
                                {selectedStores.length} {selectedStores.length === 1 ? 'Store' : 'Stores'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-500">{selectedScreenCount} Screens</span>
                        </div>
                    </div>
                    <button
                        onClick={onNext}
                        disabled={selectedStores.length === 0}
                        data-testid="step-1-next-btn"
                        className="px-8 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>Next Step</span>
                        <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default Step1LocationScreen;
