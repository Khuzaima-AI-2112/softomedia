/**
 * Whether stored media may play. A Brand's paid file plays only while the
 * Creative it belongs to is approved; approval recorded on the file itself
 * doesn't count.
 * @param {object} asset - The stored media record
 * @param {object} [creative] - The Creative the asset belongs to, for paid media
 */
export function isApprovedPlaybackAsset(asset, creative = null) {
    if (!asset || asset.status === 'rejected') return false;
    if (asset.category === 'paid' || asset.owner_type === 'brand') {
        return Boolean(creative)
            && creative.id === asset.creative_id
            && creative.approval_status === 'approved'
            && (creative.media_ids || []).includes(asset.id);
    }
    if (asset.approval_status != null) {
        return asset.approval_status === 'approved'
            && asset.eligible_for_playback !== false;
    }
    if (asset.eligible_for_playback != null) {
        return asset.eligible_for_playback === true;
    }
    return asset.status === 'approved';
}

export function isApprovedFallbackAsset(asset) {
    return Boolean(asset)
        && asset.category === 'fallback'
        && asset.content_kind === 'neutral_fallback'
        && asset.owner_type === 'platform'
        && asset.owner_id == null
        && isApprovedPlaybackAsset(asset);
}
