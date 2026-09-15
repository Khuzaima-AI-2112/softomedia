// Device API Service
// A Player authenticates as exactly one registered Screen with its device key.

import apiClient from './api.js';

/**
 * Reads the Screen identity a Player was opened with:
 *   /player?screen_id=<id>#key=<device key>
 * The key lives in the URL fragment so it is never sent in requests or referrers.
 */
export function deviceFromLocation(location = window.location) {
    const screenId = new URLSearchParams(location.search).get('screen_id');
    const deviceKey = new URLSearchParams(location.hash.replace(/^#/, '')).get('key');
    return screenId && deviceKey ? { screenId, deviceKey } : null;
}

/** The Player URL a Technical Operator opens on a Screen. */
export function playerUrlFor(screenId, deviceKey, origin = window.location.origin) {
    return `${origin}/player?screen_id=${encodeURIComponent(screenId)}#key=${encodeURIComponent(deviceKey)}`;
}

// apiClient replaces its default headers when a caller supplies any, so keep the JSON content type.
const deviceHeaders = ({ screenId, deviceKey }) => ({
    'Content-Type': 'application/json',
    Authorization: `Device ${screenId}:${deviceKey}`,
});

export const deviceAPI = {
    /** Approved Hourly Loop or Holding Slide for this Screen now. */
    async playback(device) {
        return apiClient.get('/api/device/playback', { headers: deviceHeaders(device) });
    },

    async heartbeat(device) {
        return apiClient.post('/api/device/heartbeat', {}, { headers: deviceHeaders(device) });
    },

    async proofOfPlay(device, presentation) {
        return apiClient.post('/api/device/proof-of-play', presentation, { headers: deviceHeaders(device) });
    },

    async playbackObservation(device, observation) {
        return apiClient.post('/api/device/playback-observations', observation, { headers: deviceHeaders(device) });
    },
};
