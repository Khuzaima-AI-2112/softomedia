import { useEffect, useState } from 'react';

/** Uploaded media is private: it is read from the API with the caller's credentials. */
export const isApiMediaPath = source => typeof source === 'string' && source.startsWith('/api/');

/** The API path a signed-in user reads an asset's file from. */
export const assetContentPath = assetId => (assetId ? `/api/assets/${assetId}/content` : null);

/**
 * Resolves a media source for an <img>. External and data: URLs are used as
 * they are; an API media path is fetched with `loadBlob` and shown as an object
 * URL, which is released when the source changes or the component unmounts.
 * Returns null while an API file is loading or when it cannot be read.
 */
export function useMediaSource(source, loadBlob) {
    const [objectUrl, setObjectUrl] = useState(null);
    const needsLoad = isApiMediaPath(source);

    useEffect(() => {
        setObjectUrl(null);
        if (!needsLoad) return undefined;

        let cancelled = false;
        let created = null;
        loadBlob(source)
            .then(blob => {
                if (cancelled) return;
                created = URL.createObjectURL(blob);
                setObjectUrl(created);
            })
            .catch(() => {
                if (!cancelled) setObjectUrl(null);
            });

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
        // loadBlob is expected to be stable for a given caller.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, needsLoad]);

    return needsLoad ? objectUrl : (source || null);
}
