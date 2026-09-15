import { deviceAPI } from './deviceAPI.js';

/**
 * TelemetryService
 *
 * trackImpression() fires POST /api/device/proof-of-play (fire-and-forget),
 * authenticated with the Screen's device key, and retries transient failures.
 * Failure is swallowed — the player must never stall on a network error.
 */
class TelemetryService {
    /**
     * Record a single impression. Called by Player.jsx on every ad play.
     *
     * @param {object} impression
     *   Required: device ({ screenId, deviceKey }), campaign_id
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
        this.submitProofOfPlay(proofOfPlay, record.device);
    }

    async submitProofOfPlay(proofOfPlay, device, attempt = 0) {
        try {
            await deviceAPI.proofOfPlay(device, proofOfPlay);
        } catch (error) {
            const retryDelays = [1000, 5000, 15000];
            const retryable = !error.status || [408, 429, 500, 502, 503, 504].includes(error.status);
            if (retryable && attempt < retryDelays.length) {
                setTimeout(() => this.submitProofOfPlay(proofOfPlay, device, attempt + 1), retryDelays[attempt]);
                return;
            }
            console.warn('[Telemetry] Proof of Play submission failed:', error.message);
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
        deviceAPI.playbackObservation(record.device, payload)
            .catch(error => console.warn('[Telemetry] Playback observation failed:', error.message));
    }
}

export const telemetryService = new TelemetryService();
