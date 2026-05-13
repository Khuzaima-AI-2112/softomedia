import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Grid3x3, PlayCircle, PlusCircle, Film, Image, X } from 'lucide-react';
import apiService from '../../services/ApiService';
import '../../design-tokens.css';

function slotBorderStyle(slot, isDragOver) {
    if (isDragOver) return { border: '2px dashed var(--color-primary)', backgroundColor: 'rgba(99,102,241,0.08)' };
    if (!slot?.asset_id) return { border: '2px dashed var(--color-border)', backgroundColor: 'var(--color-bg-hover)' };
    if (slot.status === 'REJECTED') return { border: '2px solid var(--color-error)', backgroundColor: 'var(--color-error-light)' };
    if (slot.status === 'REPLACED') return { border: '2px solid var(--color-success)', backgroundColor: 'var(--color-success-light)' };
    return { border: '2px solid rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.05)' };
}

function LoopBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loop, setLoop]                   = useState(null);
    const [assets, setAssets]               = useState([]);
    const [loading, setLoading]             = useState(true);
    const [saving, setSaving]               = useState(false);
    const [selectedSlot, setSelectedSlot]   = useState(null);
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [dragOverSlot, setDragOverSlot]   = useState(null);

    useEffect(() => { if (id) loadData(); }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [loopData, assetsData] = await Promise.all([apiService.getLoop(id), apiService.getAssets()]);
            setLoop(loopData);
            setAssets(assetsData || []);
        } catch (e) { console.error('Failed to load loop data:', e); }
        finally { setLoading(false); }
    };

    const handleSlotClick = (position) => { setSelectedSlot(position); setShowAssetPicker(true); };

    const handleAssetSelect = async (asset) => {
        if (selectedSlot === null || !loop) return;
        const newSlots = [...loop.slots];
        newSlots[selectedSlot] = { ...newSlots[selectedSlot], asset_id: asset.id, asset_name: asset.filename, asset_thumbnail: asset.file_type === 'image' ? 'image' : 'video', status: 'PENDING' };
        setLoop({ ...loop, slots: newSlots });
        setShowAssetPicker(false); setSelectedSlot(null);
        try { await apiService.replaceLoopSlot(id, selectedSlot, asset.id); await loadData(); }
        catch (e) { console.error('Failed to replace slot:', e); alert('Failed to replace slot'); }
    };

    const handleApproveAll = async () => {
        setSaving(true);
        try { await apiService.approveLoop(id); await loadData(); }
        catch (e) { console.error('Failed to approve loop:', e); }
        finally { setSaving(false); }
    };

    const handleDrop = async (e, position) => {
        e.preventDefault(); setDragOverSlot(null);
        const assetId = e.dataTransfer.getData('assetId');
        const asset = assets.find(a => String(a.id) === assetId);
        if (asset) { setSelectedSlot(position); await handleAssetSelect(asset); }
    };

    const formatHour = (h) => { const p = h >= 12 ? 'PM' : 'AM'; const d = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${d}:00 ${p}`; };

    const card = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)' };

    const loopStatusBadge = (status) => {
        const map = { APPROVED: { bg: 'var(--color-success-light)', color: 'var(--color-success)', label: 'Approved' }, PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e', label: 'Pending' } };
        const s = map[status] || { bg: 'var(--color-bg-hover)', color: 'var(--color-text-tertiary)', label: status };
        return <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 10px', borderRadius: 9999, backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (!loop) return (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>Loop not found.</p>
            <button onClick={() => navigate('/dashboard/admin/loops')} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Back to Loop Management</button>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                        <button
                            onClick={() => navigate('/dashboard/admin/loops')}
                            style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        ><ArrowLeft size={18} /></button>
                        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            Loop Builder — {formatHour(loop.hour)}
                        </h1>
                        {loopStatusBadge(loop.status)}
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 0 44px' }}>
                        {new Date(loop.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • 12 slots × 5 seconds = 60 second loop
                    </p>
                </div>
                {loop.status !== 'APPROVED' && (
                    <button
                        onClick={handleApproveAll} disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: 'var(--space-2) var(--space-4)',
                            backgroundColor: 'var(--color-success)', color: '#fff',
                            border: 'none', borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                            fontFamily: 'var(--font-body)',
                        }}
                    ><CheckCircle size={16} />{saving ? 'Approving…' : 'Approve Loop'}</button>
                )}
            </div>

            {/* 12-Slot Grid */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Grid3x3 size={16} style={{ color: 'var(--color-primary)' }} /> Slot Configuration
                    </h3>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                        {loop.slots?.filter(s => s.asset_id).length || 0}/12 slots filled
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-3)' }}>
                    {Array.from({ length: 12 }).map((_, position) => {
                        const slot = loop.slots?.[position] || {};
                        const asset = assets.find(a => a.id === slot.asset_id);
                        const isDragOver = dragOverSlot === position;

                        return (
                            <button
                                key={position}
                                onClick={() => handleSlotClick(position)}
                                onDragOver={e => { e.preventDefault(); setDragOverSlot(position); }}
                                onDragLeave={() => setDragOverSlot(null)}
                                onDrop={e => handleDrop(e, position)}
                                style={{
                                    position: 'relative',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                    transform: isDragOver ? 'scale(1.04)' : 'scale(1)',
                                    ...slotBorderStyle(slot, isDragOver),
                                }}
                            >
                                {/* Position badge */}
                                <div style={{
                                    position: 'absolute', top: -8, left: -8,
                                    width: 20, height: 20, borderRadius: '50%',
                                    backgroundColor: 'var(--color-primary)', color: '#fff',
                                    fontSize: 10, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{position + 1}</div>

                                <div style={{ height: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    {slot.asset_id ? (
                                        <>
                                            {slot.asset_thumbnail === 'image' || asset?.file_type === 'image'
                                                ? <Image size={24} style={{ color: 'var(--color-primary)' }} />
                                                : <Film size={24} style={{ color: 'var(--color-primary)' }} />}
                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                                {slot.asset_name || asset?.filename || slot.asset_id}
                                            </span>
                                            {slot.status === 'REJECTED' && <span style={{ fontSize: 10, color: 'var(--color-error)', fontWeight: 800 }}>REJECTED</span>}
                                        </>
                                    ) : (
                                        <>
                                            <PlusCircle size={22} style={{ color: 'var(--color-text-tertiary)' }} />
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Add Asset</span>
                                            {isDragOver && <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700 }}>Drop here</span>}
                                        </>
                                    )}
                                </div>
                                <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>5 seconds</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Timeline Preview */}
            <div style={card}>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlayCircle size={16} style={{ color: 'var(--color-primary)' }} /> Timeline Preview (60 seconds)
                </h3>
                <div style={{ width: '100%', backgroundColor: 'var(--color-bg-hover)', borderRadius: 9999, height: 32, display: 'flex', overflow: 'hidden' }}>
                    {Array.from({ length: 12 }).map((_, i) => {
                        const slot = loop.slots?.[i] || {};
                        return (
                            <div key={i} title={`Slot ${i + 1}: ${slot.asset_id || 'Empty'}`}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 700,
                                    backgroundColor: slot.asset_id
                                        ? slot.status === 'REJECTED' ? 'var(--color-error)' : 'var(--color-primary)'
                                        : 'var(--color-border)',
                                    color: slot.asset_id ? '#fff' : 'var(--color-text-tertiary)',
                                }}
                            >{i + 1}</div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                    {['0s','15s','30s','45s','60s'].map(t => <span key={t}>{t}</span>)}
                </div>
            </div>

            {/* Asset Picker Modal */}
            {showAssetPicker && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 'var(--space-4)' }}>
                    <div style={{ backgroundColor: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', maxWidth: 680, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Select Asset for Slot {(selectedSlot ?? 0) + 1}</h3>
                            <button onClick={() => setShowAssetPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', padding: 4 }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: 'var(--space-5)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', overflowY: 'auto' }}>
                            {assets.map(asset => (
                                <button
                                    key={asset.id}
                                    draggable
                                    onDragStart={e => e.dataTransfer.setData('assetId', String(asset.id))}
                                    onClick={() => handleAssetSelect(asset)}
                                    style={{
                                        padding: 'var(--space-4)', textAlign: 'center',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--color-bg-card)',
                                        cursor: 'pointer', transition: 'all var(--transition-fast)',
                                        fontFamily: 'var(--font-body)',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <div style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'center' }}>
                                        {asset.file_type === 'image' ? <Image size={32} style={{ color: 'var(--color-primary)' }} /> : <Film size={32} style={{ color: 'var(--color-primary)' }} />}
                                    </div>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', display: 'block' }}>{asset.filename}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{asset.file_type}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LoopBuilder;
