import logger from '../utils/logger.js';
import { openMediaObject } from '../utils/storage.js';

/**
 * Streams a media asset's stored file. The caller has already decided the
 * requester may see this asset.
 */
export async function sendMediaContent(res, asset) {
    try {
        const object = asset ? await openMediaObject(asset.storage_path) : null;
        if (!object) return res.status(404).json({ error: 'Media not found' });
        res.set({
            'Content-Type': object.contentType,
            'Cache-Control': 'private, max-age=300',
            ...(object.size ? { 'Content-Length': String(object.size) } : {}),
        });
        object.stream.on('error', error => {
            logger.error('Media stream failed', { assetId: asset.id, error: error.message });
            if (!res.headersSent) res.status(503).json({ error: 'Media could not be read' });
            else res.destroy(error);
        });
        return object.stream.pipe(res);
    } catch (error) {
        logger.error('Media could not be opened', { assetId: asset?.id, error: error.message });
        return res.status(503).json({ error: 'Media could not be read' });
    }
}
