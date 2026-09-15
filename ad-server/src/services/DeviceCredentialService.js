import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { screenRepository } from '../repositories/ScreenRepository.js';

/**
 * Trusted Screen device contract.
 *
 * Each registered Screen holds one high-entropy device key. Only its SHA-256
 * hash is persisted; the key itself is returned exactly once, at issuance.
 * A Player proves it is a specific Screen with
 *   Authorization: Device <screenId>:<deviceKey>
 */
const CREDENTIAL_FIELDS = Object.freeze(['device_key_hash', 'device_key_issued_at']);

const hashOf = deviceKey => createHash('sha256').update(deviceKey).digest();

/** Remove persisted credential material from a Screen before it leaves the server. */
export function withoutDeviceCredential(screen) {
    if (!screen || typeof screen !== 'object') return screen;
    return Object.fromEntries(Object.entries(screen).filter(([field]) => !CREDENTIAL_FIELDS.includes(field)));
}

export class DeviceCredentialService {
    constructor({ repository = screenRepository, clock = () => new Date() } = {}) {
        this.repository = repository;
        this.clock = clock;
    }

    /** A new device key and the Screen fields that persist its hash. */
    newCredential() {
        const deviceKey = randomBytes(32).toString('base64url');
        return {
            deviceKey,
            fields: {
                device_key_hash: hashOf(deviceKey).toString('hex'),
                device_key_issued_at: this.clock().toISOString(),
            },
        };
    }

    /** Replace a Screen's device key; the previous key stops working immediately. */
    async rotate(screenId) {
        const screen = await this.repository.findById(screenId);
        if (!screen) return null;
        const credential = this.newCredential();
        await this.repository.update(screenId, credential.fields);
        return credential.deviceKey;
    }

    /** The Screen proven by `screenId` + `deviceKey`, or null. */
    async verify(screenId, deviceKey) {
        if (typeof screenId !== 'string' || !screenId || typeof deviceKey !== 'string' || !deviceKey) {
            return null;
        }
        const screen = await this.repository.findById(screenId);
        if (typeof screen?.device_key_hash !== 'string') return null;

        const expected = Buffer.from(screen.device_key_hash, 'hex');
        const presented = hashOf(deviceKey);
        return expected.length === presented.length && timingSafeEqual(expected, presented) ? screen : null;
    }
}

export const deviceCredentialService = new DeviceCredentialService();
