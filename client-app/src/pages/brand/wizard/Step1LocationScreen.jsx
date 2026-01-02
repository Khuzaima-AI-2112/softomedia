import React, { useState } from 'react';

const Step1LocationScreen = ({ data, updateData, onNext }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('All Regions');

    const stores = [
        { id: 'SF-001', name: 'Downtown Flagship', address: '1200 Market St, San Francisco', screens: 5, status: 'Live', type: 'Flagships' },
        { id: 'SE-204', name: 'Northside Mall', address: '4500 North Way, Seattle', screens: 2, status: 'Live', type: 'Malls' },
        { id: 'PD-112', name: 'West End Plaza', address: '880 West Blvd, Portland', screens: 0, status: 'Maintenance', type: 'Flagships' },
        { id: 'DV-305', name: 'Eastside Galleria', address: '2100 East Ave, Denver', screens: 8, status: 'Live', type: 'Malls' },
    ];

    const allScreens = {
        'SF-001': [
            { id: 'SCR-1', name: 'Main Entrance Kiosk A', resolution: '1080x1920', type: 'Portrait • Video', price: 50, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApZ0S3QD-aGJ5OWs71hI8YtQZScKFQN6l9IrEH8YQBB4HqXHhu35ucpYAM3tdVrqqCKod40u3yb3Xl4VBFwtYAr4T-mEymdYydJwKug_j_BxU3QclzY1t6k3rNxQiylhO8xt8HmBin5o_uHeBPVkEfrXsfllzjk8Gw3BvBE3gQr9w3pLKnD2cnie1IP1NY6thNmBAWabFk8nbDv0yORutbERsBQBZc5DpjDZhoY2C8WeM3rwe7jVX7hMfPPdyok1Q_XQQBLufZzg' },
            { id: 'SCR-2', name: 'Checkout Video Wall', resolution: '3840x1080', type: 'Landscape • 4K', price: 120, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBgOzAxeBcTyVt1k_CP5M072NAXx3bP_QpHU0zK8ERg6Mu9iryWVSPL1OJPD7tpvs3NkfT-Oj8B7imZLuc0K6faZwwgOB_nZzJWUPi76vrlWwWaznXywkce2z2CdP0ZiVs93VycKPT_uRIzHVd0U8amR-1wLJA44IaNnsiOziKwr2c5BIsKE9Pe525Z69BzYh1b4pFkyL-wKfEb1a_5HQcjZYYweE21zfK4xth6vXI1eso6DBkSj5nCk8dDKmQbkAyRWnoYtc1XOg' },
            { id: 'SCR-3', name: 'Window Display Left', resolution: '1080x1920', type: 'Portrait • High Brightness', price: 80, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC1YsT-Kvex16VgcPzpGTwiVnzMdfRUVDczc8JWMGzi1DM8aqMquOje3mhIduXk3Z24PbUrZTxrR1HcDX0a0LOPhRQ0KZsl1NT4KuC2M5k8nO-m6gYx-i03TigVOfl0ewrmvGv2CoftF9Une04SFVo3MtUSQvF39t8jMe-Nnewi3q2b0zgU-6mly-n7jmSeat-a-Ow1uC-FohEqkuilFx9XfKap3KW6XswEPTttYepu6TKGRwjTsd0DGm-XoSoxh4eCoIFWK0oSag' }
        ],
        'SE-204': [
            { id: 'SCR-4', name: 'Mall Entrance Kiosk', resolution: '1080x1920', type: 'Portrait', price: 45, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAaS5Cx5ttq2viqNqudF_jlkAWoVtjAFetMv_J1ChhfMQzLX6nlqXZRTrnvDtEfii_ukm_mFsok0WKXD3hxVOhSdbnTiyDGciVwbkLU6ti7rE4wme3Aw4x4XsOjiy9GTRzt_7bg7A3jXAI4RoUtLcXhfByP-8M3D-WLuJmPuZ6_wiLIbKSrkUR1_48HxKtiQux9wcM5Md2kMXuGoEi-K84wOUKkw_ctNTzH0gFgiIeKoJJUm7Wkl_eyZnv2OJn9npx4u8Ndpk4Mg' }
        ]
    };

    const handleStoreSelect = (storeId) => {
        updateData({ selectedStore: storeId, selectedScreens: [] });
    };

    const toggleScreen = (screenId) => {
        const current = data.selectedScreens;
        if (current.includes(screenId)) {
            updateData({ selectedScreens: current.filter(id => id !== screenId) });
        } else {
            updateData({ selectedScreens: [...current, screenId] });
        }
    };

    const activeScreens = allScreens[data.selectedStore] || [];
    const totalPrice = activeScreens
        .filter(s => data.selectedScreens.includes(s.id))
        .reduce((sum, s) => sum + s.price, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
            {/* Left: Store Selection */}
            <aside className="lg:col-span-4 flex flex-col gap-4">
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
                    {['All Regions', 'Flagships', 'Malls'].map(f => (
                        <button
                            key={f}
                            onClick={() => setSelectedFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedFilter === f
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                    {stores
                        .filter(s => selectedFilter === 'All Regions' || s.type === selectedFilter)
                        .map(store => (
                            <div
                                key={store.id}
                                onClick={() => handleStoreSelect(store.id)}
                                data-testid={`store-${store.name.toLowerCase().replace(/\s+/g, '-')}`}
                                className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${data.selectedStore === store.id
                                    ? 'bg-white dark:bg-surface-dark border-primary shadow-md'
                                    : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-base">{store.name}</h3>
                                    <div className="flex items-center gap-1">
                                        <span className={`h-2 w-2 rounded-full ${store.status === 'Live' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                                        <span className={`text-[10px] uppercase font-bold ${store.status === 'Live' ? 'text-green-500' : 'text-orange-500'}`}>{store.status}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                                    <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                                    <span>{store.address}</span>
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <span className="text-xs text-slate-500">ID: {store.id}</span>
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{store.screens} Screens</span>
                                </div>
                            </div>
                        ))}
                </div>
            </aside>

            {/* Right: Screen Selection */}
            <section className="lg:col-span-8 flex flex-col gap-4">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                    <h2 className="text-xl font-bold">Selected Location</h2>
                    <p className="text-sm text-slate-500">
                        {data.selectedStore ? stores.find(s => s.id === data.selectedStore)?.name : 'Select a store from the sidebar'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeScreens.map(scr => (
                        <div
                            key={scr.id}
                            onClick={() => toggleScreen(scr.id)}
                            data-testid={`screen-${scr.name.toLowerCase().replace(/\s+/g, '-')}`}
                            className={`relative group flex flex-col rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${data.selectedScreens.includes(scr.id)
                                ? 'border-primary shadow-lg scale-[1.02]'
                                : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                }`}
                        >
                            {data.selectedScreens.includes(scr.id) && (
                                <div className="absolute top-3 right-3 z-10 bg-primary text-white rounded-full size-6 flex items-center justify-center shadow-md">
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                </div>
                            )}
                            <div className="aspect-video w-full bg-slate-100 relative">
                                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${scr.image}")` }} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            </div>
                            <div className="p-4 bg-white dark:bg-surface-dark flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-sm">{scr.name}</h3>
                                    <span className="text-[10px] font-mono text-slate-400">{scr.resolution}</span>
                                </div>
                                <p className="text-xs text-slate-500 mb-4">{scr.type}</p>
                                <div className="mt-auto flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <span className="text-sm font-bold">${scr.price}<span className="text-xs font-normal text-slate-500">/day</span></span>
                                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-wide">Online</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {!data.selectedStore && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                            <span className="material-symbols-outlined text-[64px] opacity-20">tv</span>
                            <p>Pick a store to view available screens</p>
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
                                <span className="text-lg font-bold">1 Store</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-lg font-bold text-primary">{data.selectedScreens.length} Screens</span>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Est. Cost</span>
                            <span className="text-lg font-bold">${totalPrice}<span className="text-xs font-normal text-slate-500">/day</span></span>
                        </div>
                    </div>
                    <button
                        onClick={onNext}
                        disabled={data.selectedScreens.length === 0}
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
