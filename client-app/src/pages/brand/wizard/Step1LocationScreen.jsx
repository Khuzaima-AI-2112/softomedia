import React, { useState, useEffect, useMemo } from 'react';
import localStorageService from '../../../services/LocalStorageService';

const Step1LocationScreen = ({ data, updateData, onNext }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRetailer, setSelectedRetailer] = useState('all');
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        localStorageService.init();
        setRetailers(localStorageService.getRetailers());
        setStores(localStorageService.getStores());
        setScreens(localStorageService.getScreens());
    };

    // Filter stores based on search and retailer
    const filteredStores = useMemo(() => {
        return stores.filter(store => {
            const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                store.address.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRetailer = selectedRetailer === 'all' || store.retailerId === selectedRetailer;
            return matchesSearch && matchesRetailer;
        });
    }, [stores, searchQuery, selectedRetailer]);

    // Get screens for selected stores
    const getStoreScreens = (storeId) => {
        return screens.filter(s => s.storeId === storeId && s.status === 'online');
    };

    const handleStoreSelect = (storeId) => {
        const current = data.selectedStores || [];
        if (current.includes(storeId)) {
            updateData({
                selectedStores: current.filter(id => id !== storeId),
                selectedScreens: (data.selectedScreens || []).filter(sid => {
                    const screen = screens.find(s => s.id === sid);
                    return screen && screen.storeId !== storeId;
                })
            });
        } else {
            updateData({
                selectedStores: [...current, storeId]
            });
        }
    };

    const toggleScreen = (screenId) => {
        const current = data.selectedScreens || [];
        if (current.includes(screenId)) {
            updateData({ selectedScreens: current.filter(id => id !== screenId) });
        } else {
            updateData({ selectedScreens: [...current, screenId] });
        }
    };

    const selectAllScreensForStore = (storeId) => {
        const storeScreens = getStoreScreens(storeId);
        const current = data.selectedScreens || [];
        const storeScreenIds = storeScreens.map(s => s.id);
        const newSelection = [...new Set([...current, ...storeScreenIds])];
        updateData({ selectedScreens: newSelection });
    };

    // Get all screens for selected stores
    const activeScreens = useMemo(() => {
        const selectedStoreIds = data.selectedStores || [];
        return screens.filter(s => selectedStoreIds.includes(s.storeId) && s.status === 'online');
    }, [screens, data.selectedStores]);

    const selectedScreenCount = (data.selectedScreens || []).length;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[500px] pb-24">
            {/* Left: Store Selection */}
            <aside className="lg:col-span-5 flex flex-col gap-4">
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

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                    {filteredStores.map(store => {
                        const retailer = retailers.find(r => r.id === store.retailerId);
                        const storeScreens = getStoreScreens(store.id);
                        const isSelected = (data.selectedStores || []).includes(store.id);

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
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <span className="text-xs text-slate-500">{retailer?.name}</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${storeScreens.length > 0 ? 'text-emerald-600 bg-emerald-100' : 'text-slate-400 bg-slate-100'}`}>
                                        {storeScreens.length} Screens
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {filteredStores.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                            <p>No stores found</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Right: Screen Selection */}
            <section className="lg:col-span-7 flex flex-col gap-4">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                    <h2 className="text-xl font-bold">Select Screens</h2>
                    <p className="text-sm text-slate-500">
                        {(data.selectedStores || []).length > 0
                            ? `${activeScreens.length} screens available across ${(data.selectedStores || []).length} stores`
                            : 'Select stores from the sidebar to see available screens'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[450px]">
                    {activeScreens.map(scr => {
                        const store = stores.find(s => s.id === scr.storeId);
                        const isSelected = (data.selectedScreens || []).includes(scr.id);

                        return (
                            <div
                                key={scr.id}
                                onClick={() => toggleScreen(scr.id)}
                                data-testid={`screen-${scr.name.toLowerCase().replace(/\s+/g, '-')}`}
                                className={`relative group flex flex-col rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected
                                        ? 'border-primary shadow-lg ring-2 ring-primary/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                    }`}
                            >
                                {isSelected && (
                                    <div className="absolute top-3 right-3 z-10 bg-primary text-white rounded-full size-6 flex items-center justify-center shadow-md">
                                        <span className="material-symbols-outlined text-[16px]">check</span>
                                    </div>
                                )}
                                <div className="aspect-video w-full bg-gradient-to-br from-slate-700 to-slate-900 relative flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white/20 text-[48px]">tv</span>
                                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-mono">
                                        {scr.resolution}
                                    </div>
                                </div>
                                <div className="p-3 bg-white dark:bg-surface-dark flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-sm">{scr.name}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">{store?.name}</p>
                                    <div className="mt-auto flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <span className="text-xs text-slate-400">{scr.orientation}</span>
                                        <span className="text-[10px] font-bold text-emerald-500 uppercase">Online</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {(data.selectedStores || []).length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
                            <span className="material-symbols-outlined text-[64px] opacity-20">tv</span>
                            <p className="mt-2">Pick stores to view available screens</p>
                        </div>
                    )}
                    {(data.selectedStores || []).length > 0 && activeScreens.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
                            <span className="material-symbols-outlined text-[64px] opacity-20">warning</span>
                            <p className="mt-2">No online screens in selected stores</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Sticky Footer */}
            <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#111722] border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
                <div className="max-w-[1440px] mx-auto px-10 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Selection</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg font-bold">{(data.selectedStores || []).length} Stores</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-lg font-bold text-primary">{selectedScreenCount} Screens</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onNext}
                        disabled={selectedScreenCount === 0}
                        data-testid="wizard-next-step"
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

