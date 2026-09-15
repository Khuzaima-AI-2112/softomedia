import { userRepository } from '../repositories/index.js';
import { toCanonicalRole } from '../constants/roles.js';

export class AuthService {
    /**
     * A profile a Super Administrator created for an email address, before any
     * Firebase account existed. Only an account that has verified that email may use it,
     * and the first such account is bound to it for good.
     */
    async profileInvitedByEmail(decodedToken) {
        if (decodedToken.email_verified !== true || !decodedToken.email) return null;
        const profile = await userRepository.findByEmail(decodedToken.email);
        if (!profile) return null;
        if (profile.auth_uid && profile.auth_uid !== decodedToken.uid) return null;
        if (!profile.auth_uid) {
            await userRepository.update(profile.id, { auth_uid: decodedToken.uid });
        }
        return { ...profile, auth_uid: decodedToken.uid };
    }

    async resolveFirebaseIdentity(decodedToken) {
        const profile = await userRepository.findById(decodedToken.uid)
            || await this.profileInvitedByEmail(decodedToken);
        const role = toCanonicalRole(profile?.role);

        // A deactivated profile is refused like a missing one.
        if (!profile || !role || profile.status === 'inactive') return null;

        if (profile.role !== role) {
            await userRepository.update(profile.id, { role });
        }

        const organizationId = profile.organization_id
            || profile.linked_entity_id
            || profile.linkedentityid
            || null;

        return {
            id: profile.id,
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: profile.name || decodedToken.name || decodedToken.email,
            role,
            linked_entity_id: organizationId,
            organization_id: organizationId,
            permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
        };
    }
}

export const authService = new AuthService();
