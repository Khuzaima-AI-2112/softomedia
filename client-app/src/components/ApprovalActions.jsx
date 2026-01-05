/**
 * ApprovalActions - Reusable component for approve/reject actions
 * Used in retailer validation workflows
 */

import React, { useState } from 'react';
import GlassCard from './GlassCard';

function ApprovalActions({
    onApprove,
    onReject,
    itemLabel = 'item',
    showRejectReason = true,
    disabled = false,
    compact = false
}) {
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleReject = () => {
        if (showRejectReason) {
            setShowRejectModal(true);
        } else {
            onReject?.();
        }
    };

    const confirmReject = () => {
        onReject?.(rejectReason);
        setShowRejectModal(false);
        setRejectReason('');
    };

    if (compact) {
        return (
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onApprove?.()}
                    disabled={disabled}
                    className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Approve"
                >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                </button>
                <button
                    onClick={handleReject}
                    disabled={disabled}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Reject"
                >
                    <span className="material-symbols-outlined text-lg">cancel</span>
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onApprove?.()}
                    disabled={disabled}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Approve
                </button>
                <button
                    onClick={handleReject}
                    disabled={disabled}
                    className="flex-1 py-2.5 px-4 rounded-xl border-2 border-rose-200 dark:border-rose-800 text-rose-500 font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">cancel</span>
                    Reject
                </button>
            </div>

            {/* Reject Reason Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-rose-500">warning</span>
                            </div>
                            <h3 className="text-lg font-bold">Reject {itemLabel}?</h3>
                        </div>

                        <p className="text-sm text-slate-500 mb-4">
                            Please provide a reason for rejection. This will be shared with the advertiser.
                        </p>

                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        />

                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReject}
                                disabled={!rejectReason.trim()}
                                className="px-4 py-2 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </>
    );
}

// Single action buttons for inline use
export function ApproveButton({ onClick, disabled = false, size = 'default' }) {
    const sizeClasses = size === 'small'
        ? 'py-1.5 px-3 text-sm'
        : 'py-2 px-4';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${sizeClasses} rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5`}
        >
            <span className="material-symbols-outlined text-[16px]">check</span>
            Approve
        </button>
    );
}

export function RejectButton({ onClick, disabled = false, size = 'default' }) {
    const sizeClasses = size === 'small'
        ? 'py-1.5 px-3 text-sm'
        : 'py-2 px-4';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${sizeClasses} rounded-lg border border-rose-200 dark:border-rose-800 text-rose-500 font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5`}
        >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Reject
        </button>
    );
}

export default ApprovalActions;
