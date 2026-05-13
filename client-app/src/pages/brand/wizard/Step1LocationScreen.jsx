import { useState, useEffect, useMemo } from 'react';
import { Monitor } from 'lucide-react';
import apiService from '../../../services/ApiService';
import '../../../design-tokens.css';

const Step1LocationScreen = ({ data, updateData, onNext }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRetailer, setSelectedRetailer] = useState('all');
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredStore, setHoveredStore] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [r, s, sc] = await Promise.all([
                apiService.getRetailers(),
                apiService.getStores(),
                apiService.getScreens(),
            ]);
            setRetailers(r); setStores(s); setScreens(sc);
        } catch (err) {
            console.error('[Step1] Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredStores = useMemo(() => stores.filter(store => {
        const q = searchQuery.toLowerCase();
        return (store.name.toLowerCase().includes(q) || (store.address || '').toLowerCase().includes(q))
            && (selectedRetailer === 'all' || store.retailer_id === selectedRetailer);
    }), [stores, searchQuery, selectedRetailer]);

    const getStoreScreens = (storeId) => screens.filter(s => s.store_id === storeId && s.status === 'online');

    const handleStoreSelect = (storeId) => {
        const current = data.selectedStores || [];
        if (current.includes(storeId)) {
            updateData({
                selectedStores: current.filter(id => id !== storeId),
                selectedScreens: (data.selectedScreens || []).filter(sid => {
                    const sc = screens.find(s => s.id === sid);
                    return sc && sc.store_id !== storeId;
                }),
            });
        } else {
            updateData({ selectedStores: [...current, storeId] });
        }
    };

    const toggleScreen = (screenId) => {
        const current = data.selectedScreens || [];
        updateData({
            selectedScreens: current.includes(screenId)
                ? current.filter(id => id !== screenId)
                : [...current, screenId],
        });
    };

    const activeScreens = useMemo(() =>
        screens.filter(s => (data.selectedStores || []).includes(s.store_id) && s.status === 'online'),
        [screens, data.selectedStores]
    );

    const selectedScreenCount = (data.selectedScreens || []).length;

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', color: 'var(--color-text-tertiary)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
                <p style={{ fontSize: 'var(--text-sm)' }}>Loading screens and locations…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const inputStyle = {
        width: '100%', padding: '0.625rem 0.875rem',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box',
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.25rem', minHeight: 500, paddingBottom: '5rem' }}>

            {/* Left: Store selection */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input style={inputStyle} placeholder="Search stores…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[{ id: 'all', name: 'All' }, ...retailers].map(r => (
                        <button key={r.id} onClick={() => setSelectedRetailer(r.id)} style={{
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
                            border: '1px solid ' + (selectedRetailer === r.id ? 'var(--color-primary)' : 'var(--color-border)'),
                            backgroundColor: selectedRetailer === r.id ? 'var(--color-primary)' : 'var(--color-bg-card)',
                            color: selectedRetailer === r.id ? '#fff' : 'var(--color-text-secondary)',
                            cursor: 'pointer', transition: 'all var(--transition-fast)',
                        }}>
                            {r.logo ? `${r.logo} ` : ''}{r.name?.split(' ')[0] ?? r.name}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', overflowY: 'auto', maxHeight: 420 }}>
                    {filteredStores.map(store => {
                        const retailer   = retailers.find(r => r.id === store.retailer_id);
                        const storeScrs  = getStoreScreens(store.id);
                        const isSelected = (data.selectedStores || []).includes(store.id);
                        const isHovered  = hoveredStore === store.id;

                        return (
                            <div
                                key={store.id}
                                onClick={() => handleStoreSelect(store.id)}
                                onMouseEnter={() => setHoveredStore(store.id)}
                                onMouseLeave={() => setHoveredStore(null)}
                                style={{
                                    padding: '0.875rem 1rem',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1.5px solid ' + (isSelected ? 'var(--color-primary)' : 'var(--color-border)'),
                                    backgroundColor: isSelected ? 'rgba(99,102,241,0.05)' : 'var(--color-bg-card)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                    boxShadow: isHovered || isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                                    transform: isHovered && !isSelected ? 'translateY(-1px)' : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {retailer?.logo && <span style={{ fontSize: '1rem' }}>{retailer.logo}</span>}
                                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>{store.name}</span>
                                    </div>
                                    {isSelected && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            width: 20, height: 20, borderRadius: '50%',
                                            backgroundColor: 'var(--color-primary)', flexShrink: 0,
                                        }}>
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                <path d="M1.5 5.5L3.5 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: '0.625rem' }}>{store.address}</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border-light)' }}>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{retailer?.name}</span>
                                    <span style={{
                                        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)',
                                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                        backgroundColor: storeScrs.length > 0 ? 'var(--color-success-light)' : 'var(--color-bg-hover)',
                                        color: storeScrs.length > 0 ? '#03543f' : 'var(--color-text-tertiary)',
                                    }}>{storeScrs.length} screens</span>
                                </div>
                            </div>
                        );
                    })}
                    {filteredStores.length === 0 && (
                        <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No stores found</p>
                    )}
                </div>
            </aside>

            {/* Right: Screen selection */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Select Screens</h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {(data.selectedStores || []).length > 0
                            ? `${activeScreens.length} screen${activeScreens.length !== 1 ? 's' : ''} available across ${(data.selectedStores || []).length} store${(data.selectedStores || []).length !== 1 ? 's' : ''}`
                            : 'Select stores from the sidebar to see available screens'}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', overflowY: 'auto', maxHeight: 460 }}>
                    {activeScreens.map(scr => {
                        const store = stores.find(s => s.id === scr.store_id);
                        const isSelected = (data.selectedScreens || []).includes(scr.id);
                        return (
                            <div key={scr.id} onClick={() => toggleScreen(scr.id)} style={{
                                borderRadius: 'var(--radius-lg)',
                                border: '1.5px solid ' + (isSelected ? 'var(--color-primary)' : 'var(--color-border)'),
                                backgroundColor: 'var(--color-bg-card)',
                                overflow: 'hidden', cursor: 'pointer',
                                transition: 'all var(--transition-fast)',
                                boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                                position: 'relative',
                            }}>
                                {isSelected && (
                                    <span style={{
                                        position: 'absolute', top: 8, right: 8, zIndex: 2,
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 22, height: 22, borderRadius: '50%',
                                        backgroundColor: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)',
                                    }}>
                                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                            <path d="M1.5 6L4 8.5L9.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </span>
                                )}
                                {/* Neutral placeholder replacing dark gradient */}
                                <div style={{
                                    aspectRatio: '16/9',
                                    backgroundColor: 'var(--color-bg-hover)',
                                    borderBottom: '1.5px dashed var(--color-border)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    gap: '0.375rem', position: 'relative',
                                }}>
                                    <Monitor size={28} style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }} />
                                    {scr.resolution && (
                                        <span style={{
                                            position: 'absolute', bottom: 6, left: 6,
                                            fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
                                            backgroundColor: 'rgba(0,0,0,0.08)', color: 'var(--color-text-secondary)',
                                            padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                                        }}>{scr.resolution}</span>
                                    )}
                                </div>
                                <div style={{ padding: '0.625rem 0.75rem' }}>
                                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: '1px' }}>{scr.name}</p>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>{store?.name}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.375rem', borderTop: '1px solid var(--color-border-light)' }}>
                                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{scr.orientation}</span>
                                        <span style={{ fontSize: '0.6875rem', fontWeight: 'var(--font-bold)', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Online</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {(data.selectedStores || []).length === 0 && (
                        <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: 'var(--color-text-tertiary)' }}>
                            <Monitor size={48} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                            <p style={{ fontSize: 'var(--text-sm)' }}>Pick stores to view available screens</p>
                        </div>
                    )}
                    {(data.selectedStores || []).length > 0 && activeScreens.length === 0 && (
                        <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: 'var(--color-text-tertiary)' }}>
                            <p style={{ fontSize: 'var(--text-sm)' }}>No online screens in selected stores</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Sticky footer */}
            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
                backgroundColor: 'var(--color-bg-card)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                padding: '0.875rem 2.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div>
                    <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 'var(--font-bold)', color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Selection</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '2px' }}>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>{(data.selectedStores || []).length} Stores</span>
                        <span style={{ color: 'var(--color-border)' }}>•</span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-primary)' }}>{selectedScreenCount} Screens</span>
                    </div>
                </div>
                <button
                    onClick={onNext}
                    disabled={selectedScreenCount === 0}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        height: 38, padding: '0 1.25rem',
                        backgroundColor: 'var(--color-primary)', color: '#fff',
                        border: 'none', borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                        cursor: selectedScreenCount === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedScreenCount === 0 ? 0.5 : 1,
                        transition: 'all var(--transition-fast)', boxShadow: 'var(--shadow-md)',
                    }}
                    onMouseEnter={e => { if (selectedScreenCount > 0) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                >
                    Next Step →
                </button>
            </footer>
        </div>
    );
};

export default Step1LocationScreen;
