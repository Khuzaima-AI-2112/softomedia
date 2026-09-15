import apiClient from '../services/api.js';
import { useMediaSource } from '../hooks/useMediaSource.js';

const loadWithSignIn = path => apiClient.get(path, { responseType: 'blob' });

/**
 * An image whose file may be private media served by the API. The signed-in
 * user's credentials are sent; `fallbackSrc` shows while loading or when the
 * file cannot be read.
 */
export default function ProtectedImage({ src, fallbackSrc = null, alt, ...props }) {
    const resolved = useMediaSource(src, loadWithSignIn) || fallbackSrc;
    if (!resolved) return <span role="img" aria-label={alt} {...props} />;
    return <img src={resolved} alt={alt} {...props} />;
}
