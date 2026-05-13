import { useState, useEffect } from 'react';
import { Store, CalendarDays, Clock, Save, ChevronLeft, ChevronRight, Check, Info, AlertCircle } from 'lucide-react';
import apiService from '../../services/ApiService';
import '../../design-tokens.css';

const DAYS = [
    { id: 0, name: 'Sunday' }, { id: 1, name: 'Monday' }, { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' }, { id: 4, name: 'Thursday' }, { id: 5, name: 'Friday' }, { id: 6, name: 'Saturday' },
];

function BusinessHoursManagement() {
    const [stores, setStores]           = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [weeklyHours, setWeeklyHours] = useState([]);
    const [specialHours, setSpecialHours] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [message, setMessage]         = useState(null);
    const [activeTab, setActiveTab]     = useState('weekly');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showSpecialModal, setShowSpecialModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [specialFormData, setSpecialFormData] = useState({ open_time: '09:00', close_time: '18:00', is_closed: false, reason: '' });

    useEffect(() => { loadStores(); }, []);
    useEffect(() => { if (selectedStore) loadStoreHours(selectedStore.id); }, [selectedStore]);

    const loadStores = async () => {
        try {
            setLoading(true);
            const all = await apiService.getStores();
            setStores(all);
            if (all.length > 0) setSelectedStore(all[0]);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadStoreHours = async (storeId) => {
        try {
            const [weekly, special] = await Promise.all([apiService.getWeeklyHours(storeId), apiService.listSpecialHours(storeId)]);
            const full = DAYS.map(day => {
                const ex = weekly.find(w => parseInt(w.day_of_week) === day.id);
                return ex || { day_of_week: day.id, open_time: '09:00', close_time: '18:00', is_closed: false };
            }).sort((a, b) => a.day_of_week - b.day_of_week);
            setWeeklyHours(full);
            setSpecialHours(special || []);
        } catch (e) { console.error(e); }
    };

    const handleWeeklyUpdate = (idx, field, value) => {
        const n = [...weeklyHours]; n[idx] = { ...n[idx], [field]: value }; setWeeklyHours(n);
    };

    const saveWeeklyHours = async () => {
        if (!selectedStore) return;
        setSaving(true); setMessage({ type: 'info', text: 'Saving weekly schedule…' });
        try { await apiService.updateWeeklyHours(selectedStore.id, weeklyHours); setMessage({ type: 'success', text: 'Weekly schedule saved!' }); }
        catch (e) { setMessage({ type: 'error', text: `Failed: ${e.message}` }); }
        finally { setSaving(false); setTimeout(() => setMessage(null), 3000); }
    };

    const handleDateClick = async (date) => {
        const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
        const ds = `${y}-${m}-${d}`; setSelectedDate(ds);
        const ex = specialHours.find(h => h.date === ds);
        if (ex) { setSpecialFormData({ open_time: ex.open_time || '09:00', close_time: ex.close_time || '18:00', is_closed: ex.is_closed || false, reason: ex.reason || '' }); }
        else {
            const dow = date.getDay(); const def = weeklyHours.find(w => parseInt(w.day_of_week) === dow);
            setSpecialFormData({ open_time: def?.open_time || '09:00', close_time: def?.close_time || '18:00', is_closed: def?.is_closed || false, reason: '' });
        }
        setShowSpecialModal(true);
    };

    const saveSpecialHours = async () => {
        if (!selectedStore || !selectedDate) return;
        setSaving(true);
        try { await apiService.updateSpecialHours(selectedStore.id, selectedDate, specialFormData); await loadStoreHours(selectedStore.id); setShowSpecialModal(false); setMessage({ type: 'success', text: `Special hours for ${selectedDate} updated!` }); }
        catch (e) { setMessage({ type: 'error', text: `Failed: ${e.message}` }); }
        finally { setSaving(false); setTimeout(() => setMessage(null), 3000); }
    };

    const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();
    const generateCalendarDays = () => {
        const y = currentDate.getFullYear(), m = currentDate.getMonth(), days = [];
        const prev = daysInMonth(y, m - 1), first = firstDayOfMonth(y, m);
        for (let i = first - 1; i >= 0; i--) days.push({ day: prev - i, month: m - 1, year: y, padding: true });
        for (let i = 1; i <= daysInMonth(y, m); i++) days.push({ day: i, month: m, year: y, padding: false });
        return days;
    };

    const card = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', position: 'relative', overflow: 'hidden' };
    const inputStyle = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)', outline: 'none', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums', width: '100%', boxSizing: 'border-box' };

    const msgColors = { success: { bg: 'var(--color-success-light)', color: 'var(--color-success)' }, error: { bg: 'var(--color-error-light)', color: 'var(--color-error)' }, info: { bg: 'rgba(99,102,241,0.08)', color: 'var(--color-primary)' } };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Business Hours</h1>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>Manage operational hours and holiday overrides for your retail network</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-8)', alignItems: 'start' }}>

                {/* Store Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', margin: '0 0 var(--space-1) var(--space-1)' }}>Select Store</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {stores.map(store => {
                            const isActive = selectedStore?.id === store.id;
                            return (
                                <button
                                    key={store.id}
                                    onClick={() => setSelectedStore(store)}
                                    style={{
                                        width: '100%', textAlign: 'left',
                                        padding: 'var(--space-3) var(--space-4)',
                                        borderRadius: 'var(--radius-md)',
                                        border: 'none', cursor: 'pointer',
                                        backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                                        color: isActive ? '#fff' : 'var(--color-text-secondary)',
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                        fontFamily: 'var(--font-body)',
                                        transition: 'all var(--transition-fast)',
                                    }}
                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <Store size={16} />
                                    <div>
                                        <p style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)', margin: 0, lineHeight: 1.3 }}>{store.name}</p>
                                        <p style={{ fontSize: 'var(--text-xs)', opacity: isActive ? 0.7 : 1, color: isActive ? '#fff' : 'var(--color-text-tertiary)', margin: 0 }}>{store.city}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main content */}
                {selectedStore && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 4, padding: 4, backgroundColor: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
                            {[{ key: 'weekly', label: 'Standard Week' }, { key: 'overrides', label: 'Future Overrides' }].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setActiveTab(t.key)}
                                    style={{
                                        padding: 'var(--space-2) var(--space-5)',
                                        borderRadius: 'var(--radius-sm)', border: 'none',
                                        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                                        cursor: 'pointer', fontFamily: 'var(--font-body)',
                                        backgroundColor: activeTab === t.key ? 'var(--color-bg-card)' : 'transparent',
                                        color: activeTab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                        boxShadow: activeTab === t.key ? 'var(--shadow-sm)' : 'none',
                                        transition: 'all var(--transition-fast)',
                                    }}
                                >{t.label}</button>
                            ))}
                        </div>

                        {/* Toast */}
                        {message && (() => { const c = msgColors[message.type]; return (
                            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: c.bg, color: c.color, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {message.type === 'success' ? <Check size={15} /> : message.type === 'error' ? <AlertCircle size={15} /> : <Info size={15} />}
                                {message.text}
                            </div>
                        ); })()}

                        {/* Weekly tab */}
                        {activeTab === 'weekly' && (
                            <div style={card}>
                                {/* accent bar */}
                                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '4px 0 0 4px' }} />
                                <div style={{ paddingLeft: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(99,102,241,0.1)' }}>
                                                <Clock size={16} style={{ color: 'var(--color-primary)' }} />
                                            </div>
                                            <div>
                                                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Weekly Schedule</h2>
                                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Standard Operational Hours</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={saveWeeklyHours} disabled={saving}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'var(--font-body)' }}
                                        ><Save size={14} />Save Changes</button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {DAYS.map((day, idx) => {
                                            const hours = weeklyHours[idx] || {};
                                            return (
                                                <div key={day.id} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: 'var(--space-3) var(--space-4)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-border)',
                                                    backgroundColor: hours.is_closed ? 'var(--color-bg-hover)' : 'var(--color-bg-card)',
                                                    transition: 'background-color var(--transition-fast)',
                                                }}>
                                                    <p style={{ width: 110, fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)', color: hours.is_closed ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', margin: 0 }}>{day.name}</p>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-6)', padding: '0 var(--space-4)' }}>
                                                        {!hours.is_closed ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Open</label>
                                                                    <input type="time" value={hours.open_time} onChange={e => handleWeeklyUpdate(idx, 'open_time', e.target.value)} style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 'var(--text-sm)', fontWeight: 600, outline: 'none', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }} />
                                                                </div>
                                                                <span style={{ color: 'var(--color-border)' }}>→</span>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Close</label>
                                                                    <input type="time" value={hours.close_time} onChange={e => handleWeeklyUpdate(idx, 'close_time', e.target.value)} style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 'var(--text-sm)', fontWeight: 600, outline: 'none', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-body)' }} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 10px', borderRadius: 9999, backgroundColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>CLOSED ALL DAY</span>
                                                        )}
                                                    </div>
                                                    {/* Toggle */}
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Closed</span>
                                                        <div
                                                            onClick={() => handleWeeklyUpdate(idx, 'is_closed', !hours.is_closed)}
                                                            style={{ position: 'relative', width: 40, height: 22, borderRadius: 9999, backgroundColor: hours.is_closed ? 'var(--color-primary)' : 'var(--color-border)', cursor: 'pointer', transition: 'background-color var(--transition-fast)', flexShrink: 0 }}
                                                        >
                                                            <div style={{ position: 'absolute', top: 3, left: hours.is_closed ? 21 : 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', transition: 'left var(--transition-fast)' }} />
                                                        </div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Overrides tab */}
                        {activeTab === 'overrides' && (
                            <div style={card}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: '#f59e0b', borderRadius: '4px 0 0 4px' }} />
                                <div style={{ paddingLeft: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245,158,11,0.1)' }}>
                                                <CalendarDays size={16} style={{ color: '#f59e0b' }} />
                                            </div>
                                            <div>
                                                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Override Calendar</h2>
                                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Set Future Date Specific Hours</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><ChevronLeft size={18} /></button>
                                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', minWidth: 130, textAlign: 'center' }}>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} style={{ padding: 6, borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><ChevronRight size={18} /></button>
                                        </div>
                                    </div>

                                    {/* Calendar grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                                            <div key={d} style={{ backgroundColor: 'var(--color-bg-hover)', padding: 'var(--space-2)', textAlign: 'center', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)' }}>{d}</div>
                                        ))}
                                        {generateCalendarDays().map((dayObj, i) => {
                                            const d = new Date(dayObj.year, dayObj.month, dayObj.day);
                                            const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dn = String(d.getDate()).padStart(2, '0');
                                            const ds = `${y}-${m}-${dn}`;
                                            const isToday = new Date().toLocaleDateString('en-CA') === ds;
                                            const override = specialHours.find(h => h.date === ds);
                                            const dow = d.getDay(); const def = weeklyHours.find(w => parseInt(w.day_of_week) === dow);
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => !dayObj.padding && handleDateClick(d)}
                                                    disabled={dayObj.padding}
                                                    style={{
                                                        minHeight: 90, padding: 'var(--space-2)', textAlign: 'left',
                                                        backgroundColor: dayObj.padding ? 'rgba(0,0,0,0.02)' : 'var(--color-bg-card)',
                                                        border: 'none', cursor: dayObj.padding ? 'default' : 'pointer',
                                                        outline: override ? '1px solid rgba(245,158,11,0.4)' : 'none',
                                                        fontFamily: 'var(--font-body)',
                                                        transition: 'background-color var(--transition-fast)',
                                                    }}
                                                    onMouseEnter={e => { if (!dayObj.padding) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                                                    onMouseLeave={e => { if (!dayObj.padding) e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'; }}
                                                >
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        fontSize: 11, fontWeight: 700,
                                                        backgroundColor: isToday ? 'var(--color-primary)' : 'transparent',
                                                        color: isToday ? '#fff' : dayObj.padding ? 'var(--color-border)' : 'var(--color-text-secondary)',
                                                        marginBottom: 4,
                                                    }}>{dayObj.day}</span>
                                                    {!dayObj.padding && (
                                                        <div style={{ fontSize: 9, lineHeight: 1.4 }}>
                                                            {override ? (
                                                                <div style={{ padding: '2px 4px', borderRadius: 4, backgroundColor: override.is_closed ? 'var(--color-error-light)' : '#fef3c7', color: override.is_closed ? 'var(--color-error)' : '#92400e', fontWeight: 700 }}>
                                                                    {override.reason || (override.is_closed ? 'CLOSED' : 'OVERRIDE')}
                                                                    {!override.is_closed && <div style={{ fontWeight: 400 }}>{override.open_time}–{override.close_time}</div>}
                                                                </div>
                                                            ) : (
                                                                <span style={{ color: 'var(--color-text-tertiary)' }}>
                                                                    {def?.is_closed ? 'Default: Closed' : `${def?.open_time}–${def?.close_time}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Special Hours Modal */}
                        {showSpecialModal && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 'var(--space-4)' }}>
                                <div style={{ ...card, width: '100%', maxWidth: 420 }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, backgroundColor: '#f59e0b', borderRadius: '4px 4px 0 0' }} />
                                    <div style={{ paddingTop: 'var(--space-2)' }}>
                                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: '0 0 2px' }}>Set Special Hours</h2>
                                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
                                            {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'full' }) : ''}
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Reason / Event Name</label>
                                                <input type="text" value={specialFormData.reason} onChange={e => setSpecialFormData({ ...specialFormData, reason: e.target.value })} placeholder="e.g. Labor Day, Renovation…" style={inputStyle} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
                                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>Store is Closed</span>
                                                <div
                                                    onClick={() => setSpecialFormData({ ...specialFormData, is_closed: !specialFormData.is_closed })}
                                                    style={{ position: 'relative', width: 40, height: 22, borderRadius: 9999, backgroundColor: specialFormData.is_closed ? 'var(--color-error)' : 'var(--color-border)', cursor: 'pointer', transition: 'background-color var(--transition-fast)', flexShrink: 0 }}
                                                >
                                                    <div style={{ position: 'absolute', top: 3, left: specialFormData.is_closed ? 21 : 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', transition: 'left var(--transition-fast)' }} />
                                                </div>
                                            </div>
                                            {!specialFormData.is_closed && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Open Time</label>
                                                        <input type="time" value={specialFormData.open_time} onChange={e => setSpecialFormData({ ...specialFormData, open_time: e.target.value })} style={inputStyle} />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Close Time</label>
                                                        <input type="time" value={specialFormData.close_time} onChange={e => setSpecialFormData({ ...specialFormData, close_time: e.target.value })} style={inputStyle} />
                                                    </div>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                                                <button onClick={() => setShowSpecialModal(false)} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', cursor: 'pointer', fontFamily: 'var(--font-body)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Cancel</button>
                                                <button onClick={saveSpecialHours} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'var(--space-2) var(--space-5)', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
                                                    {saving && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />}
                                                    Apply Override
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default BusinessHoursManagement;
