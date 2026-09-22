import { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { assetContentPath } from '../hooks/useMediaSource';

const loadWithSignIn = path => apiClient.get(path, { responseType: 'blob' });

/**
 * Plays a Loop's currently assigned Slot assets in real broadcast order and
 * duration — what the Screen will show if the Retailer Administrator
 * approves. Reads `slots` live, so a replaced or rejected Slot's asset is
 * never stale.
 */
function LoopPlaybackPreview({ slots, onClose }) {
    const [index, setIndex] = useState(0);
    const [media, setMedia] = useState(null);
    const [muted, setMuted] = useState(true);

    const hasSlots = slots.length > 0;
    const slot = hasSlots ? slots[index] : null;
    const assetId = slot?.asset_id || null;
    const duration = slot?.duration || 5;

    useEffect(() => {
        let cancelled = false;
        let createdUrl = null;
        setMedia(null);

        const path = assetContentPath(assetId);
        if (!path) return undefined;

        loadWithSignIn(path)
            .then(blob => {
                if (cancelled) return;
                createdUrl = URL.createObjectURL(blob);
                setMedia({ url: createdUrl, kind: blob.type?.startsWith('video/') ? 'video' : 'image' });
            })
            .catch(() => {
                if (!cancelled) setMedia(null);
            });

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [assetId]);

    // Advance to the next Slot after its real broadcast duration; loops
    // continuously until the Retailer Administrator closes the preview.
    useEffect(() => {
        if (!hasSlots) return undefined;
        const timer = setTimeout(() => {
            setIndex(prev => (prev + 1) % slots.length);
        }, duration * 1000);
        return () => clearTimeout(timer);
    }, [index, duration, hasSlots, slots.length]);

    return (
        <div className="absolute inset-0 bg-black rounded-2xl flex items-center justify-center z-20" data-testid="loop-playback-preview">
            {media?.kind === 'video' && (
                <video
                    key={media.url}
                    data-testid="preview-video"
                    src={media.url}
                    autoPlay
                    muted={muted}
                    playsInline
                    className="max-w-full max-h-full"
                />
            )}
            {media?.kind === 'image' && (
                <img
                    key={media.url}
                    data-testid="preview-image"
                    src={media.url}
                    alt={slot?.asset_name || `Slot ${index + 1}`}
                    className="max-w-full max-h-full object-contain"
                />
            )}
            {!media && (
                <div data-testid="preview-empty-slot" className="text-white/60 text-sm">
                    {!hasSlots ? 'No Slots in this Loop' : assetId ? 'Loading…' : 'Empty slot'}
                </div>
            )}

            {hasSlots && (
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-bold">
                    Slot {index + 1}/{slots.length}
                </div>
            )}

            {media?.kind === 'video' && (
                <button
                    onClick={() => setMuted(prev => !prev)}
                    data-testid="preview-mute-toggle"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                    className="absolute bottom-4 left-4 px-3 py-2 rounded-full bg-black/60 text-white"
                >
                    <span className="material-symbols-outlined text-[20px]">
                        {muted ? 'volume_off' : 'volume_up'}
                    </span>
                </button>
            )}

            <button
                onClick={onClose}
                data-testid="preview-close-btn"
                aria-label="Close preview"
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white"
            >
                <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
        </div>
    );
}

export default LoopPlaybackPreview;
