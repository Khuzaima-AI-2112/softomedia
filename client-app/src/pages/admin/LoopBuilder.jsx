/**
 * Loop Builder Page
 * Admin interface for editing a single hourly loop (12 slots)
 * Each slot: 5 seconds duration
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import { API_URL } from '../../config';

// Mock asset library for demo
const MOCK_ASSETS = [
    { id: 'asset_001', name: 'Summer Sale Banner', type: 'image', thumbnail: '🏖️' },
    { id: 'asset_002', name: 'Tech Deal Video', type: 'video', thumbnail: '💻' },
    { id: 'asset_003', name: 'Fashion Promo', type: 'image', thumbnail: '👗' },
    { id: 'asset_004', name: 'Food Special', type: 'image', thumbnail: '🍕' },
    { id: 'asset_005', name: 'Sports Brand', type: 'video', thumbnail: '⚽' },
    { id: 'asset_006', name: 'Beauty Product', type: 'image', thumbnail: '💄' },
    { id: 'asset_007', name: 'Auto Dealer', type: 'video', thumbnail: '🚗' },
    { id: 'asset_008', name: 'Travel Agency', type: 'image', thumbnail: '✈️' },
];

// Get slot status styling
const getSlotStyle = (slot) => {
    if (!slot?.asset_id) return 'border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50';
    if (slot.status === 'REJECTED') return 'border-red-400 bg-red-50 dark:bg-red-900/20';
    if (slot.status === 'REPLACED') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
    return 'border-primary/50 bg-primary/5';
};

function LoopBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loop, setLoop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showAssetPicker, setShowAssetPicker] = useState(false);

    useEffect(() => {
        if (id) fetchLoop();
    }, [id]);

    const fetchLoop = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/loops/${id}`);
            if (res.ok) {
                const data = await res.json();
                setLoop(data);
            } else {
                console.error('Loop not found');
            }
        } catch (error) {
            console.error('Failed to fetch loop:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSlotClick = (position) => {
        setSelectedSlot(position);
        setShowAssetPicker(true);
    };

    const handleAssetSelect = async (asset) => {
        if (selectedSlot === null || !loop) return;

        // Update local state optimistically
        const newSlots = [...loop.slots];
        newSlots[selectedSlot] = {
            ...newSlots[selectedSlot],
            asset_id: asset.id,
            asset_name: asset.name,
            asset_thumbnail: asset.thumbnail,
            status: 'PENDING'
        };
        setLoop({ ...loop, slots: newSlots });
        setShowAssetPicker(false);
        setSelectedSlot(null);

        // 🔶 TODO: Persist to backend
        // await fetch(`${API_URL}/api/loops/${id}/slots/${selectedSlot}/replace`, {
        //     method: 'PATCH',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ assetId: asset.id })
        // });
    };

    const handleApproveAll = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/loops/${id}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'admin_demo' })
            });
            if (res.ok) {
                await fetchLoop();
            }
        } catch (error) {
            console.error('Failed to approve loop:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatHour = (hour) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:00 ${period}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!loop) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-slate-600">Loop not found</h2>
                <button
                    onClick={() => navigate('/dashboard/admin/loops')}
                    className="mt-4 text-primary hover:underline"
                >
                    Back to Loop Management
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => navigate('/dashboard/admin/loops')}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Loop Builder — {formatHour(loop.hour)}
                        </h1>
                        <StatusBadge status={loop.status === 'APPROVED' ? 'Active' :
                            loop.status === 'PENDING_APPROVAL' ? 'Warning' : 'Offline'} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 ml-12">
                        {new Date(loop.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })} • 12 slots × 5 seconds = 60 second loop
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {loop.status !== 'APPROVED' && (
                        <button
                            onClick={handleApproveAll}
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                            data-testid="approve-loop-btn"
                        >
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            {saving ? 'Approving...' : 'Approve Loop'}
                        </button>
                    )}
                </div>
            </div>

            {/* 12-Slot Grid */}
            <GlassCard>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">grid_view</span>
                        Slot Configuration
                    </h3>
                    <span className="text-sm text-slate-500">
                        {loop.slots?.filter(s => s.asset_id).length || 0}/12 slots filled
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="slot-grid">
                    {Array.from({ length: 12 }).map((_, position) => {
                        const slot = loop.slots?.[position] || {};
                        const asset = MOCK_ASSETS.find(a => a.id === slot.asset_id);

                        return (
                            <button
                                key={position}
                                onClick={() => handleSlotClick(position)}
                                className={`relative p-4 rounded-xl border-2 transition-all hover:shadow-md hover:scale-105 ${getSlotStyle(slot)}`}
                                data-testid={`slot-${position}`}
                            >
                                {/* Position Badge */}
                                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                                    {position + 1}
                                </div>

                                {/* Slot Content */}
                                <div className="h-20 flex flex-col items-center justify-center">
                                    {slot.asset_id ? (
                                        <>
                                            <span className="text-3xl mb-1">
                                                {slot.asset_thumbnail || asset?.thumbnail || '📄'}
                                            </span>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center line-clamp-1">
                                                {slot.asset_name || asset?.name || slot.asset_id}
                                            </span>
                                            {slot.status === 'REJECTED' && (
                                                <span className="text-[10px] text-red-500 font-bold mt-1">REJECTED</span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-2xl text-slate-400">add_circle</span>
                                            <span className="text-xs text-slate-400 mt-1">Add Asset</span>
                                        </>
                                    )}
                                </div>

                                {/* Duration */}
                                <div className="text-[10px] text-center text-slate-400 mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                                    5 seconds
                                </div>
                            </button>
                        );
                    })}
                </div>
            </GlassCard>

            {/* Loop Timeline Preview */}
            <GlassCard>
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">play_circle</span>
                    Timeline Preview (60 seconds)
                </h3>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-8 flex overflow-hidden">
                    {Array.from({ length: 12 }).map((_, i) => {
                        const slot = loop.slots?.[i] || {};
                        return (
                            <div
                                key={i}
                                className={`flex-1 flex items-center justify-center text-xs font-bold transition-colors ${slot.asset_id
                                    ? slot.status === 'REJECTED'
                                        ? 'bg-red-400 text-white'
                                        : 'bg-primary text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                    }`}
                                title={`Slot ${i + 1}: ${slot.asset_id || 'Empty'}`}
                            >
                                {i + 1}
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>0s</span>
                    <span>15s</span>
                    <span>30s</span>
                    <span>45s</span>
                    <span>60s</span>
                </div>
            </GlassCard>

            {/* Asset Picker Modal */}
            {showAssetPicker && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Select Asset for Slot {selectedSlot + 1}</h3>
                            <button
                                onClick={() => setShowAssetPicker(false)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh]">
                            {MOCK_ASSETS.map(asset => (
                                <button
                                    key={asset.id}
                                    onClick={() => handleAssetSelect(asset)}
                                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-lg transition-all text-center"
                                    data-testid={`asset-${asset.id}`}
                                >
                                    <span className="text-4xl block mb-2">{asset.thumbnail}</span>
                                    <span className="text-sm font-medium">{asset.name}</span>
                                    <span className="text-xs text-slate-500 block">{asset.type}</span>
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
