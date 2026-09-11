import express from 'express';
import { demoOrganizationRepository, platformAuditRepository } from '../repositories/index.js';
import { requirePlatformGovernance } from '../middleware/requireRole.js';

const router = express.Router();

router.use(requirePlatformGovernance);

router.get('/organizations', async (_req, res) => {
    try {
        res.json(await demoOrganizationRepository.findAll());
    } catch {
        res.status(500).json({ error: 'Failed to fetch demo organizations' });
    }
});

router.get('/audit', async (_req, res) => {
    try {
        res.json(await platformAuditRepository.findAll());
    } catch {
        res.status(500).json({ error: 'Failed to fetch platform audit records' });
    }
});

router.post('/organizations', async (req, res) => {
    const { name, type } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Organization name is required' });
    }
    if (typeof type !== 'string' || !type.trim()) {
        return res.status(400).json({ error: 'Organization type is required' });
    }

    try {
        const organization = await demoOrganizationRepository.create({
            name: name.trim(),
            type: type.trim(),
            status: 'active',
        });
        res.status(201).json(organization);
    } catch {
        res.status(500).json({ error: 'Failed to create demo organization' });
    }
});

router.patch('/organizations/:id', async (req, res) => {
    const { name, type, status } = req.body || {};
    const updates = {};

    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Organization name must be a non-empty string' });
        }
        updates.name = name.trim();
    }
    if (type !== undefined) {
        if (typeof type !== 'string' || !type.trim()) {
            return res.status(400).json({ error: 'Organization type must be a non-empty string' });
        }
        updates.type = type.trim();
    }
    if (status !== undefined) {
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'Organization status must be active or inactive' });
        }
        updates.status = status;
    }

    if (!Object.keys(updates).length) {
        return res.status(400).json({ error: 'At least one organization field is required' });
    }

    try {
        const existing = await demoOrganizationRepository.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Demo organization not found' });
        res.json(await demoOrganizationRepository.update(req.params.id, updates));
    } catch {
        res.status(500).json({ error: 'Failed to update demo organization' });
    }
});

export default router;
