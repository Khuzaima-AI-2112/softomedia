import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { mediaRepository } from '../repositories/index.js';

const router = express.Router();

// Ensure assets directory exists
const ASSETS_DIR = 'assets';
if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ASSETS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.mp4'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: .png, .jpg, .jpeg, .gif, .mp4'));
        }
    }
});

import { uploadFile } from '../utils/storage.js';

/**
 * GET /api/assets
 * List media assets available for campaigns
 */
router.get('/', async (req, res) => {
    try {
        const assets = await mediaRepository.findAll();
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/assets/upload
 * Register a new creative asset
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { duration, file_type } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload to Cloud Storage (GCS)
        const cloudStorage = await uploadFile(file.path, file.filename);

        const id = `ast_${Date.now()}`;
        const asset = await mediaRepository.create(id, {
            id,
            filename: file.originalname,
            duration: parseInt(duration) || 5,
            file_type: file_type || file.mimetype,
            storage_path: cloudStorage.storage_path,
            url: cloudStorage.url,
            status: 'ready',
            created_at: new Date().toISOString()
        });
        res.status(201).json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
