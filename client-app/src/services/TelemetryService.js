import { API_URL } from '../config';

const STORAGE_KEY = 'softomedia_impression_buffer';
const BATCH_SIZE_THRESHOLD = 50; // Upload when we have this many items
const BATCH_TIME_THRESHOLD = 60 * 60 * 1000; // or every 1 hour

class TelemetryService {
    constructor() {
        this.buffer = this.loadBuffer();
        this.lastUploadAttempt = Date.now();

        // Auto-save buffer to storage on visibility change (page hide/close)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveBuffer();
            }
        });

        // Start periodic check
        setInterval(() => this.checkUploadCriteria(), 60 * 1000); // Check every minute
    }

    loadBuffer() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load telemetry buffer', e);
            return [];
        }
    }

    saveBuffer() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
        } catch (e) {
            console.error('Failed to save telemetry buffer', e);
        }
    }

    trackImpression(impression) {
        const record = {
            ...impression,
            timestamp: new Date().toISOString(),
            uuid: crypto.randomUUID() // Unique ID for de-duplication
        };

        this.buffer.push(record);
        this.saveBuffer();
        this.checkUploadCriteria();

        // White-box logging for SRE verification (Test Mode)
        if (window.__TELEMETRY_LOG__) {
            window.__TELEMETRY_LOG__.push({ type: 'IMPRESSION_QUEUED', payload: record });
        }
    }

    async checkUploadCriteria() {
        const timeSinceUpload = Date.now() - this.lastUploadAttempt;
        const shouldUpload = this.buffer.length >= BATCH_SIZE_THRESHOLD || timeSinceUpload >= BATCH_TIME_THRESHOLD;

        if (this.buffer.length > 0 && shouldUpload) {
            await this.uploadBatch();
        }
    }

    async uploadBatch() {
        if (this.isUploading) return;
        this.isUploading = true;

        try {
            // 1. Get Signed URL
            const response = await fetch(`${API_URL}/api/telemetry/upload-url`);
            const { uploadUrl } = await response.json();

            // 2. Prepare Payload (NDJSON or CSV)
            const payload = JSON.stringify(this.buffer);

            // 3. Upload (The "Drop-off")
            const putResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });

            if (!putResponse.ok) throw new Error('Upload PUT failed');

            console.log(`[Telemetry] Batch upload success: ${this.buffer.length} items`);

            // Simulate successful upload for MVP/Test
            // For E2E: We can inspect this log or state to verify "upload attempt"

            // 4. Clear Buffer on Success
            this.buffer = [];
            this.saveBuffer();
            this.lastUploadAttempt = Date.now();

            if (window.__TELEMETRY_LOG__) {
                window.__TELEMETRY_LOG__.push({ type: 'BATCH_UPLOAD_SUCCESS', count: this.buffer.length });
            }

        } catch (e) {
            console.error('Telemetry upload failed', e);
            // Retry later (buffer is preserved)
        } finally {
            this.isUploading = false;
        }
    }

    // Manual trigger for testing
    async forceUpload() {
        await this.uploadBatch();
    }
}

export const telemetryService = new TelemetryService();

// Expose for E2E Testing (SRE Requirement)
if (import.meta.env.MODE === 'test' || window.location.search.includes('debug=true')) {
    window.softomedia_telemetry = telemetryService;
}
