/**
 * Loop Preview Modal
 * Displays a single hour's loop for retailer validation
 * Allows approve/reject of individual ads
 */

import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { API_URL } from '../config';

// Rejection reasons dropdown options
const REJECTION_REASONS = [
    { value: 'inappropriate', label: 'Inappropriate Content' },
    { value: 'competitor', label: 'Competitor Brand' },
    { value: 'low_quality', label: 'Low Quality' },
    { value: 'off_brand', label: 'Off-Brand / Not Aligned' },
    { value: 'other', label: 'Other' }
];

// 🔶 Mock replacement assets (in production, fetch from API)
const REPLACEMENT_ASSETS = [
    { id: 'replace_001', name: 'Generic Promo A', thumbnail: '🎯' },
    { id: 'replace_002', name: 'Store Announcement', thumbnail: '📢' },
    { id: 'replace_003', name: 'Holiday Special', thumbnail: '🎄' },
    { id: 'replace_004', name: 'Clearance Sale', thumbnail: '🏷️' },
];

// Format hour
const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

function LoopPreviewModal({ loop, onClose, onRefresh }) {
    const [slots, setSlots] = useState(loop.slots || []);
    const [rejectingSlot, setRejectingSlot] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [replacingSlot, setReplacingSlot] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleRejectSlot = async (position) => {
        if (!rejectionReason) {
            alert('Please select a rejection reason');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/loops/${loop.id}/slots/${position}/reject`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectionReason })
            });

            if (res.ok) {
                const updated = await res.json();
                setSlots(updated.slots);
                setRejectingSlot(null);
                setRejectionReason('');
                // Immediately show replacement picker
                setReplacingSlot(position);
            }
        } catch (error) {
            console.error('Failed to reject slot:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReplaceSlot = async (position, assetId) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/loops/${loop.id}/slots/${position}/replace`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId })
            });

            if (res.ok) {
                const updated = await res.json();
                setSlots(updated.slots);
                setReplacingSlot(null);
            }
        } catch (error) {
            console.error('Failed to replace slot:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleApproveLoop = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/loops/${loop.id}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'retailer_demo' })
            });

            if (res.ok) {
                onRefresh?.();
                onClose();
            }
        } catch (error) {
            console.error('Failed to approve loop:', error);
        } finally {
            setSaving(false);
        }
    };

    const rejectedCount = slots.filter(s => s.status === 'REJECTED').length;
    const canApprove = rejectedCount === 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">schedule</span>
                            {formatHour(loop.hour)} — Loop Preview
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {new Date(loop.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })} • 12 ads × 5 seconds
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={
                            loop.status === 'APPROVED' ? 'Active' :
                                loop.status === 'PENDING_APPROVAL' ? 'Warning' : 'Offline'
                        } />
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Slot Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="loop-slots">
                        {slots.map((slot, position) => (
                            <div
                                key={position}
                                className={`relative p-4 rounded-xl border-2 ${slot.status === 'REJECTED'
                                        ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                                        : slot.status === 'REPLACED'
                                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                            : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                data-testid={`preview-slot-${position}`}
                            >
                                {/* Position Badge */}
                                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                                    {position + 1}
                                </div>

                                {/* Slot Content */}
                                <div className="h-16 flex flex-col items-center justify-center mb-3">
                                    <span className="text-3xl mb-1">
                                        {slot.asset_thumbnail || '📦'}
                                    </span>
                                    <span className="text-xs font-medium text-center line-clamp-1">
                                        {slot.asset_name || slot.asset_id || 'Empty'}
                                    </span>
                                </div>

                                {/* Status & Actions */}
                                {slot.status === 'REJECTED' ? (
                                    <div className="text-center">
                                        <span className="text-xs text-red-500 font-bold block mb-2">
                                            REJECTED: {slot.rejection_reason}
                                        </span>
                                        <button
                                            onClick={() => setReplacingSlot(position)}
                                            className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg font-medium"
                                            data-testid={`replace-btn-${position}`}
                                        >
                                            Select Replacement
                                        </button>
                                    </div>
                                ) : slot.status === 'REPLACED' ? (
                                    <div className="text-center">
                                        <span className="text-xs text-emerald-600 font-bold">✓ REPLACED</span>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setRejectingSlot(position)}
                                            className="flex-1 text-xs px-2 py-1.5 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
                                            data-testid={`reject-btn-${position}`}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-sm text-slate-500">
                        {rejectedCount > 0 ? (
                            <span className="text-red-500 font-bold">
                                ⚠️ {rejectedCount} ad{rejectedCount > 1 ? 's' : ''} need replacement before approval
                            </span>
                        ) : (
                            <span className="text-emerald-500 font-bold">
                                ✓ All ads are ready for broadcast
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApproveLoop}
                            disabled={!canApprove || saving}
                            className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            data-testid="approve-loop-btn"
                        >
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            {saving ? 'Approving...' : 'Approve Loop'}
                        </button>
                    </div>
                </div>

                {/* Rejection Reason Modal */}
                {rejectingSlot !== null && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                            <h4 className="font-bold text-lg mb-4">Reject Slot {rejectingSlot + 1}</h4>
                            <p className="text-sm text-slate-500 mb-4">
                                Please select a reason for rejecting this ad:
                            </p>
                            <select
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-4"
                                data-testid="rejection-reason-select"
                            >
                                <option value="">Select reason...</option>
                                {REJECTION_REASONS.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setRejectingSlot(null);
                                        setRejectionReason('');
                                    }}
                                    className="flex-1 px-4 py-2 text-slate-600 font-medium border border-slate-200 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleRejectSlot(rejectingSlot)}
                                    disabled={!rejectionReason || saving}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-lg disabled:opacity-50"
                                    data-testid="confirm-reject-btn"
                                >
                                    {saving ? 'Rejecting...' : 'Confirm Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Replacement Picker Modal */}
                {replacingSlot !== null && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                            <h4 className="font-bold text-lg mb-4">
                                Select Replacement for Slot {replacingSlot + 1}
                            </h4>
                            <p className="text-sm text-slate-500 mb-4">
                                Choose an approved asset to replace the rejected ad:
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4" data-testid="replacement-picker">
                                {REPLACEMENT_ASSETS.map(asset => (
                                    <button
                                        key={asset.id}
                                        onClick={() => handleReplaceSlot(replacingSlot, asset.id)}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-lg transition-all text-center"
                                        data-testid={`replacement-${asset.id}`}
                                    >
                                        <span className="text-3xl block mb-2">{asset.thumbnail}</span>
                                        <span className="text-sm font-medium">{asset.name}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setReplacingSlot(null)}
                                className="w-full px-4 py-2 text-slate-600 font-medium border border-slate-200 rounded-lg"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LoopPreviewModal;
