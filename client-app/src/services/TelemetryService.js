import { API_URL } from '../config';
import apiClient from './api.js';

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
     *   Required: event_id (generated here), location_id, asset_id, loop_id,
     *   slot_position, presentation_started_at, intended_duration_seconds
     */
    trackImpression(impression) {
        const record = {
            ...impression,
            presentation_started_at: impression.presentation_started_at || new Date().toISOString(),
            event_id: impression.event_id || crypto.randomUUID()
        };

        const screen_id = record.screen_id || record.screenId;
        const campaign_id = record.campaign_id || record.campaignId;
        const asset_id = record.asset_id || record.assetId || record.mediaId;
        const loop_id = record.loop_id || record.loopId;
        const location_id = record.location_id || record.locationId;
        const slot_position = record.slot_position ?? record.slotPosition;
        const intended_duration_seconds = record.intended_duration_seconds ?? record.duration;

        const proofOfPlay = {
            event_id: record.event_id,
            screen_id,
            location_id,
            loop_id,
            slot_position,
            campaign_id,
            asset_id,
            presentation_started_at: record.presentation_started_at,
            intended_duration_seconds,
        };
        this.submitProofOfPlay(proofOfPlay, record.authToken);

        // ── Layer 2: local buffer for batch fallback ──────────────────────────
        this.buffer.push(record);
        this.saveBuffer();
        this.checkUploadCriteria();

        // White-box logging for SRE / E2E test verification
        if (window.__TELEMETRY_LOG__) {
            window.__TELEMETRY_LOG__.push({ type: 'IMPRESSION_QUEUED', payload: record });
        }
    }

    async submitProofOfPlay(proofOfPlay, authToken, attempt = 0) {
        try {
            await apiClient.post('/api/telemetry/impression', proofOfPlay, {
                ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
            });
        } catch (error) {
            const retryDelays = [1000, 5000, 15000];
            const retryable = !error.status || [408, 429, 500, 502, 503, 504].includes(error.status);
            if (retryable && attempt < retryDelays.length) {
                setTimeout(() => this.submitProofOfPlay(proofOfPlay, authToken, attempt + 1), retryDelays[attempt]);
                return;
            }
            console.warn('[Telemetry] Proof of Play submission failed; local buffer preserved:', error.message);
        }
    }

    trackPlaybackObservation(observation) {
        const record = {
            ...observation,
            event_id: observation.event_id || crypto.randomUUID(),
            presentation_started_at: observation.presentation_started_at || new Date().toISOString(),
        };
        const payload = {
            event_id: record.event_id,
            screen_id: record.screenId,
            location_id: record.locationId,
            loop_id: record.loopId,
            slot_position: record.slotPosition,
            asset_id: record.assetId,
            presentation_type: record.presentationType,
            presentation_started_at: record.presentation_started_at,
            intended_duration_seconds: record.duration,
        };
        apiClient.post('/api/telemetry/playback-observation', payload, {
            ...(record.authToken ? { headers: { Authorization: `Bearer ${record.authToken}` } } : {}),
        }).catch(error => console.warn('[Telemetry] Playback observation failed:', error.message));
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
