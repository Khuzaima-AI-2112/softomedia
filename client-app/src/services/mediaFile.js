/** Files the upload inputs offer; the server checks each one again. */
export const ACCEPTED_MEDIA = '.png,.jpg,.jpeg,.mp4,.mov';

// If the browser says nothing about a file, the server decides.
const PLAYABILITY_TIMEOUT_MS = 10_000;

function canPlay(file) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        const settle = playable => {
            clearTimeout(timer);
            URL.revokeObjectURL(url);
            resolve(playable);
        };
        const timer = setTimeout(() => settle(true), PLAYABILITY_TIMEOUT_MS);
        video.preload = 'metadata';
        video.addEventListener('loadedmetadata', () => settle(true), { once: true });
        video.addEventListener('error', () => settle(false), { once: true });
        video.src = url;
    });
}

/**
 * Whether a chosen file is checked in the browser before upload. Only a .mov
 * is, as a convenience: Screens play what this browser plays, and many .mov
 * files use codecs it can't decode. Duration and frame are checked by the server.
 */
export const needsPlaybackCheck = file => Boolean(file?.name.toLowerCase().endsWith('.mov'));

/** Why a chosen file can't be uploaded, or null. */
export async function refusalForChosenFile(file) {
    if (!needsPlaybackCheck(file)) return null;
    return await canPlay(file)
        ? null
        : `This browser can't play ${file.name}. Export it as an .mp4 and try again.`;
}
