import { BaseRepository } from './BaseRepository.js';

export class DemoOrganizationRepository extends BaseRepository {
    constructor() {
        super('demo_organizations');
    }

    async create(data) {
        const id = data.id || `demo_org_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return super.create(id, {
            ...data,
            demo: true,
        });
    }
}

export const demoOrganizationRepository = new DemoOrganizationRepository();
