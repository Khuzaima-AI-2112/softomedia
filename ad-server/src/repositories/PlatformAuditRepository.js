import { BaseRepository } from './BaseRepository.js';
import { DEMO_RESET_SCOPE, DEMO_RESET_SCOPE_FIELD } from '../services/DemoBaseline.js';

export class PlatformAuditRepository extends BaseRepository {
    constructor() {
        super('platform_audits');
    }

    buildRecord(entry) {
        return {
            id: `platform_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...entry,
            [DEMO_RESET_SCOPE_FIELD]: DEMO_RESET_SCOPE,
        };
    }

    async record(entry) {
        const { id, ...data } = this.buildRecord(entry);
        return this.create(id, data);
    }
}

export const platformAuditRepository = new PlatformAuditRepository();
