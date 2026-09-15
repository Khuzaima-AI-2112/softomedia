import { userRepository } from '../repositories/index.js';
import { toCanonicalRole } from '../constants/roles.js';

export class AuthService {
    async resolveFirebaseIdentity(decodedToken) {
        const profile = await userRepository.findById(decodedToken.uid)
            || await userRepository.findByEmail(decodedToken.email);
        const role = toCanonicalRole(profile?.role);

        if (!profile || !role) return null;

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
