export function isApprovedPlaybackAsset(asset) {
    if (!asset || asset.status === 'rejected') return false;
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
