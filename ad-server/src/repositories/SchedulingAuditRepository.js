import { BaseRepository } from './BaseRepository.js';

import { randomUUID } from 'node:crypto';

export class SchedulingAuditRepository extends BaseRepository {
    constructor() {
        super('scheduling_audits');
    }

    /**
     * Log a scheduling action
     */
    async logAction(action, metadata) {
        const id = `audit_${Date.now()}_${randomUUID()}`;
        return this.create(id, {
            action,
            ...metadata,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Find audits by location
     */
    async findByLocation(locationId) {
        return this.findAll({
            where: [['location_id', '==', locationId]],
            orderBy: ['timestamp', 'desc']
        });
    }
}

export const schedulingAuditRepository = new SchedulingAuditRepository();
