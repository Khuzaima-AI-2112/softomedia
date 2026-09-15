import logger from '../utils/logger.js';
import { authService } from '../services/AuthService.js';
import { getFirebaseAuth } from '../utils/firebaseAuth.js';

function authenticationFailure(res) {
    return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Verifies a Firebase ID token and loads the corresponding Softomedia identity.
 * A Firebase ID token is the only credential a user can present.
 */
export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return authenticationFailure(res);
    }

    try {
        const decoded = await getFirebaseAuth().verifyIdToken(authHeader.slice('Bearer '.length));
        req.user = await authService.resolveFirebaseIdentity(decoded);
        if (!req.user) return authenticationFailure(res);
        return next();
    } catch (error) {
        logger.warn('Authentication failed', { reason: error.code || error.name });
        return authenticationFailure(res);
    }
};
