import express from 'express';
import { backupService } from '../services/BackupService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Trigger a Firestore backup
// In production, this should be gated by an API key or internal identity
router.post('/backup', async (req, res) => {
    try {
        const bucket = req.body.bucket || 'softomedia-live-2026-backups';
        const result = await backupService.exportDatabase(bucket);
        res.json({
            success: true,
            message: 'Backup operation started',
            details: result
        });
    } catch (error) {
        logger.error('API Backup failed', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to start backup',
            error: error.message
        });
    }
});

export default router;
