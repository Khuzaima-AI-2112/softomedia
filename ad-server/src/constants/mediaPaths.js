/**
 * Uploaded media is private and read only through the API: signed-in users at
 * the asset content path, Screens at the device media path with their device key.
 */
export const assetContentPath = assetId => `/api/assets/${assetId}/content`;

export const deviceMediaPath = assetId => `/api/device/media/${assetId}`;
