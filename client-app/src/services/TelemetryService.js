import { API_URL } from '../config';

const STORAGE_KEY = 'softomedia_impression_buffer';
const BATCH_SIZE_THRESHOLD = 50;            // Upload when we have this many items
const BATCH_TIME_THRESHOLD = 60 * 60 * 1000; // or every 1 hour

/**
 * TelemetryService
 *
 * Two-layer impression reporting:
 *
 * Layer 1 — Real-time (per-play)
 *   trackImpression() immediately fires POST /api/telemetry/impression
 *   (fire-and-forget). This populates Firestore in real time and increments
 *   campaign.play_count via the server handler.
 *   Failure is swallowed — the player must never stall on a network error.
 *
 * Layer 2 — Batch fallback
 *   Every impression is also buffered in localStorage (with try/catch so the
 *   sandboxed-iframe environment never throws). When the buffer reaches
 *   BATCH_SIZE_THRESHOLD items or BATCH_TIME_THRESHOLD ms have passed,
 *   uploadBatch() pushes the full buffer to the signed-URL sink.
 *   This provides a durable offline fallback for screens with intermittent
 *   connectivity.
 *
 * Sprint 10 fix:
 *   - Added real-time POST in trackImpression() (was buffer-only before)
 *   - Fixed batch success log: captured count BEFORE clearing buffer
 */
class TelemetryService {
    constructor() {
        this.buffer = this.loadBuffer();
        this.lastUploadAttempt = Date.now();
        this.isUploading = false;

        // Auto-save buffer to storage on page hide/close
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.saveBuffer();
                }
            });
        }

        // Periodic batch check — every 60 seconds
        setInterval(() => this.checkUploadCriteria(), 60 * 1000);
    }

    loadBuffer() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            // localStorage unavailable (sandboxed iframe or private browsing) — use in-memory only
            return [];
        }
    }

    saveBuffer() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
        } catch {
            // Silently ignore — in-memory buffer is still intact for this session
        }
    }

    /**
     * Record a single impression.
     *
     * Called by Player.jsx on every ad play. Does two things:
     *   1. Fires a real-time POST /api/telemetry/impression (fire-and-forget).
     *      This is the primary Firestore write path wired in Sprint 10.
     *   2. Buffers the impression locally for the batch-upload fallback.
     *
     * @param {object} impression
     *   Required: screen_id, campaign_id
     *   Optional: asset_id, loop_id, played_at
     */
    trackImpression(impression) {
        const record = {
            ...impression,
            played_at: impression.played_at || new Date().toISOString(),
            uuid: crypto.randomUUID()
        };

        const screen_id = record.screen_id || record.screenId;
        const campaign_id = record.campaign_id || record.campaignId;
        const asset_id = record.asset_id || record.assetId || record.mediaId;
        const loop_id = record.loop_id || record.loopId;

        // ── Layer 1: real-time per-impression POST ────────────────────────────
        // Fire-and-forget — player must never await this.
        // The server handler (telemetry.js) validates screen_id + campaign_id,
        // persists to Firestore, and increments campaign.play_count.
        // eslint-disable-next-line no-restricted-syntax
        fetch(`${API_URL}/api/telemetry/impression`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                screen_id,
                campaign_id,
                asset_id:    asset_id  || null,
                loop_id:     loop_id   || null,
                played_at:   record.played_at
            })
        }).catch(err => {
            // Network failure — batch layer below will catch it on next sync
            console.warn('[Telemetry] Real-time impression POST failed (will retry via batch):', err.message);
        });

        // ── Layer 2: local buffer for batch fallback ──────────────────────────
        this.buffer.push(record);
        this.saveBuffer();
        this.checkUploadCriteria();

        // White-box logging for SRE / E2E test verification
        if (window.__TELEMETRY_LOG__) {
            window.__TELEMETRY_LOG__.push({ type: 'IMPRESSION_QUEUED', payload: record });
        }
    }

    async checkUploadCriteria() {
        const timeSinceUpload = Date.now() - this.lastUploadAttempt;
        const shouldUpload =
            this.buffer.length >= BATCH_SIZE_THRESHOLD ||
            timeSinceUpload >= BATCH_TIME_THRESHOLD;

        if (this.buffer.length > 0 && shouldUpload) {
            await this.uploadBatch();
        }
    }

    async uploadBatch() {
        if (this.isUploading) return;
        this.isUploading = true;

        // Capture count before clearing so the log is accurate
        const batchCount = this.buffer.length;

        try {
            // 1. Get signed upload URL
            // eslint-disable-next-line no-restricted-syntax
            const response = await fetch(`${API_URL}/api/telemetry/upload-url`);
            const { uploadUrl } = await response.json();

            // 2. Upload full buffer as JSON
            // eslint-disable-next-line no-restricted-syntax
            const putResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.buffer)
            });

            if (!putResponse.ok) throw new Error(`Upload PUT failed: ${putResponse.status}`);

            // 3. Clear buffer on success
            this.buffer = [];
            this.saveBuffer();
            this.lastUploadAttempt = Date.now();



            if (window.__TELEMETRY_LOG__) {
                window.__TELEMETRY_LOG__.push({ type: 'BATCH_UPLOAD_SUCCESS', count: batchCount });
            }
        } catch (err) {
            console.error('[Telemetry] Batch upload failed — buffer preserved for retry:', err.message);
        } finally {
            this.isUploading = false;
        }
    }

    /** Manual trigger for testing */
    async forceUpload() {
        await this.uploadBatch();
    }
}

export const telemetryService = new TelemetryService();

// Expose instance for E2E / SRE verification
if (import.meta.env.MODE === 'test' || (typeof window !== 'undefined' && window.location.search.includes('debug=true'))) {
    window.softomedia_telemetry = telemetryService;
}
