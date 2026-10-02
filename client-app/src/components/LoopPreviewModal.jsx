/**
 * Loop Preview Modal
 * Shows a single hour's loop to the Retailer Administrator. Nobody approves an
 * Hourly Loop (ADR 0007); the Retailer Administrator previews it (#21).
 */

import { useState } from 'react';
import LoopPlaybackPreview from './LoopPlaybackPreview';

// Format hour
const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
};

function LoopPreviewModal({ loop, onClose }) {
    const slots = loop.slots || [];
    const [showPlayback, setShowPlayback] = useState(false);

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
                        <button
                            onClick={() => setShowPlayback(true)}
                            data-testid="btn-preview-playback"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">play_circle</span>
                            Preview Loop
                        </button>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            data-testid="btn-modal-close" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
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
                                className={`relative p-4 rounded-xl border-2 ${slot.status?.toLowerCase() === 'replaced'
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
                                <div className="h-16 flex flex-col items-center justify-center">
                                    <span className="text-3xl mb-1">
                                        {slot.asset_thumbnail || '📦'}
                                    </span>
                                    <span className="text-xs font-medium text-center line-clamp-1">
                                        {slot.asset_name || slot.asset_id || 'Empty'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Loop Playback Preview — plays the loop's currently assigned Slot assets in real broadcast order */}
                {showPlayback && (
                    <LoopPlaybackPreview slots={slots} onClose={() => setShowPlayback(false)} />
                )}
            </div>
        </div>
    );
}

export default LoopPreviewModal;
