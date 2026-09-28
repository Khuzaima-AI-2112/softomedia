import { BaseRepository } from './BaseRepository.js';

export class PlatformAuditRepository extends BaseRepository {
    constructor() {
        super('platform_audits');
    }

    buildRecord(entry) {
        return {
            id: `platform_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...entry,
        };
    }

    async record(entry) {
        const { id, ...data } = this.buildRecord(entry);
        return this.create(id, data);
    }
}

export const platformAuditRepository = new PlatformAuditRepository();
