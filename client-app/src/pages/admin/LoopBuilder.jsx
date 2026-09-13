import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiService from '../../services/ApiService';
import { ToastContainer, useToasts } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';

// Only Admin corrects requested content; approval belongs to Retailer Administrator.
// Operations staff (and any other role not in this list) get read-only access.
const EDITOR_ROLES = ['admin'];

const getSlotStyle = (slot) => {
    if (!slot?.asset_id) {
        return 'border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50';
    }
    if (slot.status?.toLowerCase() === 'rejected') return 'border-red-400 bg-red-50 dark:bg-red-900/20';
    if (slot.status?.toLowerCase() === 'replaced') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
    return 'border-primary/50 bg-primary/5';
};

function LoopBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Read-only if the user's role is not in the editor allow-list.
    // Defaults to read-only if role is undefined (safest fallback).
    const isReadOnly = !EDITOR_ROLES.includes(user?.role);

    const [loop, setLoop] = useState(null);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showAssetPicker, setShowAssetPicker] = useState(false);

    const [approvalWindow, setApprovalWindow] = useState(null);
    const [storeTimeZone, setStoreTimeZone] = useState(null);
    const [showReopen, setShowReopen] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [reopenExpiry, setReopenExpiry] = useState('');

    const { toasts, addToast, removeToast } = useToasts();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [loopData, assetsData] = await Promise.all([
                apiService.getLoop(id),
                apiService.getAssets()
            ]);
            setLoop(loopData);
            setAssets(assetsData || []);
            if (loopData.store_id && loopData.date) {
                const review = await apiService.getScheduleReview(loopData.store_id, loopData.date);
                setApprovalWindow(review.approval_window);
                setStoreTimeZone(review.store?.time_zone || null);
            }
        } catch (error) {
            console.error('Failed to load loop data:', error);
            addToast('Failed to load loop data. Please refresh.', 'error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) loadData();
    }, [id, loadData]);

    const handleSlotClick = (position) => {
        if (isReadOnly) return;
        setSelectedSlot(position);
        setShowAssetPicker(true);
    };

    const handleAssetSelect = async (asset) => {
        if (selectedSlot === null || !loop) return;

        // Optimistic update
        const newSlots = [...loop.slots];
        newSlots[selectedSlot] = {
            ...newSlots[selectedSlot],
            asset_id: asset.id,
            asset_name: asset.filename,
            asset_thumbnail: asset.file_type === 'image' ? '🖼️' : '🎬',
            status: 'PENDING'
        };
        setLoop({ ...loop, slots: newSlots });
        setShowAssetPicker(false);
        setSelectedSlot(null);
        try {
            // The API returns the full loop object, which may have a new id
            // if the loop was APPROVED and was cloned into a new draft version.
            // Always consume the full response — never assume the id is unchanged.
            const responseLoop = await apiService.replaceLoopSlot(loop.id, selectedSlot, asset.id);
            setLoop(responseLoop);
            addToast(`Slot ${selectedSlot + 1} updated with "${asset.filename}".`, 'success');
        } catch (error) {
            console.error('Failed to replace slot:', error);
            const message = error?.response?.data?.error || error?.message || 'Failed to replace slot.';
            addToast(message, 'error');
            // Revert optimistic update
            await loadData();
        }
    };

    const handleReopen = async () => {
        if (!reopenReason.trim() || !reopenExpiry) return;
        setSaving(true);
        try {
            const reopened = await apiService.reopenApprovalWindow(loop.store_id, loop.date, {
                reason: reopenReason,
                expires_at: reopenExpiry,
            });
            setApprovalWindow(reopened);
            setShowReopen(false);
            setReopenReason('');
            setReopenExpiry('');
            addToast('Approval Window reopened for Retailer Administrator review.', 'success');
        } catch (error) {
            const message = error?.message || 'Failed to reopen Approval Window.';
            addToast(message, 'error');
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
            <div data-testid="no-data-state" className="text-center py-12">
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

            {/* Read-only banner — visible to non-editor roles only */}
            {isReadOnly && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                    <span className="material-symbols-outlined text-amber-600 text-[20px]">visibility</span>
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                        You are viewing this loop in read-only mode. Contact a super-admin to request editor access.
                    </p>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => navigate('/dashboard/admin/loops')}
                            aria-label="Back to Loop Management"
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Loop Builder — {formatHour(loop.hour)}
                        </h1>
                        <StatusBadge status={
                            loop.status?.toLowerCase() === 'approved' ? 'Active' :
                            loop.status?.toLowerCase() === 'pending_approval' ? 'Warning' : 'Offline'
                        } />
                        {loop.version > 1 && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                v{loop.version} — {loop.status?.toLowerCase() === 'pending_approval' ? 'Pending Approval' : loop.status}
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 ml-12">
                        {new Date(loop.date).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })} • 12 slots × 5 seconds = 60 second loop
                    </p>
                </div>
            </div>

            {approvalWindow && (
                <GlassCard>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Approval Window</p>
                            <p className="font-bold capitalize" data-testid="approval-window-state">
                                {approvalWindow.state.replace('_', ' ').replace(/^./, value => value.toUpperCase())}
                            </p>
                            <p className="text-sm text-slate-500">
                                {new Date(approvalWindow.effective_deadline).toLocaleString('en-US', {
                                    timeZone: storeTimeZone || undefined,
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                                })}
                            </p>
                        </div>
                        {approvalWindow.state === 'expired' && ['admin', 'superadmin'].includes(user?.role) && (
                            <button
                                type="button"
                                data-testid="reopen-approval-window"
                                onClick={() => setShowReopen(true)}
                                className="px-4 py-2 bg-primary text-white rounded-lg font-medium"
                            >
                                Reopen for Retailer Administrator
                            </button>
                        )}
                    </div>
                </GlassCard>
            )}

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
                        const asset = assets.find(a => a.id === slot.asset_id);
                        return (
                            <button
                                key={position}
                                onClick={() => handleSlotClick(position)}
                                disabled={isReadOnly}
                                aria-label={slot.asset_id
                                    ? `Slot ${position + 1}: ${slot.asset_name || asset?.filename || slot.asset_id}${isReadOnly ? '' : ' — click to replace'}`
                                    : `Slot ${position + 1}: empty${isReadOnly ? '' : ' — click to add asset'}`
                                }
                                className={`relative p-4 rounded-xl border-2 transition-all ${isReadOnly ? 'cursor-default' : 'hover:shadow-md hover:scale-105'} ${getSlotStyle(slot)}`}
                                data-testid={`slot-${position}`}
                            >
                                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                                    {position + 1}
                                </div>
                                <div className="h-20 flex flex-col items-center justify-center">
                                    {slot.asset_id ? (
                                        <>
                                            <span className="text-3xl mb-1">
                                                {slot.asset_thumbnail || (asset?.file_type === 'image' ? '🖼️' : '🎬')}
                                            </span>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center line-clamp-1">
                                                {slot.asset_name || asset?.filename || slot.asset_id}
                                            </span>
                                            {slot.status?.toLowerCase() === 'rejected' && (
                                                <span className="text-[10px] text-red-500 font-bold mt-1">REJECTED</span>
                                            )}
                                            {slot.rejection_reason && (
                                                <span className="text-[10px] text-red-600 mt-1">{slot.rejection_reason}</span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-2xl text-slate-400">add_circle</span>
                                            <span className="text-xs mt-1 text-slate-400">
                                                Add Asset
                                            </span>
                                        </>
                                    )}
                                </div>
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
                                className={`flex-1 flex items-center justify-center text-xs font-bold transition-colors ${
                                    slot.asset_id
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
                                aria-label="Close asset picker"
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh]">
                            {assets.map(asset => (
                                <button
                                    key={asset.id}
                                    onClick={() => handleAssetSelect(asset)}
                                    aria-label={`Select ${asset.filename}`}
                                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-lg transition-all text-center"
                                    data-testid={`asset-${asset.id}`}
                                >
                                    <span className="text-4xl block mb-2">{asset.file_type === 'image' ? '🖼️' : '🎬'}</span>
                                    <span className="text-sm font-medium">{asset.filename}</span>
                                    <span className="text-xs text-slate-500 block">{asset.file_type}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showReopen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
                        <h3 className="font-bold text-lg mb-2">Reopen Approval Window</h3>
                        <p className="text-sm text-slate-500 mb-4">This restores Retailer Administrator review access and does not approve content.</p>
                        <label className="block text-sm font-medium mb-1" htmlFor="reopen-reason">Reason</label>
                        <textarea
                            id="reopen-reason"
                            data-testid="reopen-reason"
                            value={reopenReason}
                            onChange={event => setReopenReason(event.target.value)}
                            className="w-full p-2 border rounded-lg mb-4 dark:bg-slate-800"
                        />
                        <label className="block text-sm font-medium mb-1" htmlFor="reopen-expiry">Store-local expiry</label>
                        <input
                            id="reopen-expiry"
                            type="datetime-local"
                            data-testid="reopen-expiry"
                            value={reopenExpiry}
                            onChange={event => setReopenExpiry(event.target.value)}
                            className="w-full p-2 border rounded-lg mb-6 dark:bg-slate-800"
                        />
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => setShowReopen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReopen}
                                disabled={saving || !reopenReason.trim() || !reopenExpiry}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                data-testid="confirm-reopen"
                            >
                                {saving ? 'Reopening...' : 'Reopen Window'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
    );
}

export default LoopBuilder;
