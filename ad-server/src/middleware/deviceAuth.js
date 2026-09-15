import { deviceCredentialService } from '../services/DeviceCredentialService.js';

const DEVICE_SCHEME = 'Device ';

function deviceAuthenticationFailure(res) {
    return res.status(401).json({ error: 'Device authentication required' });
}

/**
 * Authenticates a Player as one registered Screen:
 *   Authorization: Device <screenId>:<deviceKey>
 * Sets req.device = { screen_id, screen }. User sign-in tokens are not accepted.
 */
export async function authenticateDevice(req, res, next) {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith(DEVICE_SCHEME)) {
        return deviceAuthenticationFailure(res);
    }

    const credential = header.slice(DEVICE_SCHEME.length);
    const separator = credential.lastIndexOf(':');
    if (separator <= 0) return deviceAuthenticationFailure(res);

    try {
        const screenId = credential.slice(0, separator);
        const screen = await deviceCredentialService.verify(screenId, credential.slice(separator + 1));
        if (!screen) return deviceAuthenticationFailure(res);
        req.device = { screen_id: screen.id, screen };
        return next();
    } catch (error) {
        return next(error);
    }
}
