import express from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { mediaRepository } from '../repositories/index.js';
import { deleteMediaObject, uploadMediaObject } from '../utils/storage.js';
import { ROLES, normalizeRole } from '../constants/roles.js';

const router = express.Router();
const CATEGORIES = new Set(['paid', 'retailer', 'internal', 'fallback']);
const APPROVAL_STATES = new Set(['approved', 'pending_approval', 'rejected']);
const ACCEPTED_FILES = new Map([
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.mp4', 'video/mp4'],
]);
const PLATFORM_MEDIA_ROLES = new Set([ROLES.ADMIN, ROLES.SUPERADMIN]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, fieldSize: 2 * 1024 * 1024, files: 1 },
});

function receiveFile(req, res, next) {
    upload.single('file')(req, res, error => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'File must be 5 MB or smaller'
            : error.message;
        return res.status(400).json({ error: message });
    });
}

function resolveUploadMetadata(req, category) {
    const role = normalizeRole(req.user?.role);
    if (PLATFORM_MEDIA_ROLES.has(role)) {
        return {
            ownerType: req.body.owner_type,
            ownerId: req.body.owner_id?.trim() || null,
            approvalStatus: req.body.approval_status,
        };
    }
    if (role === ROLES.BRAND && category === 'paid') {
        return {
            ownerType: 'brand',
            ownerId: req.user.linked_entity_id || req.user.organization_id || null,
            approvalStatus: 'pending_approval',
        };
    }
    return null;
}

function hasExpectedSignature(file, extension) {
    if (extension === '.png') {
        return file.buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
    }
    if (extension === '.jpg' || extension === '.jpeg') {
        return file.buffer.length >= 3
            && file.buffer[0] === 0xff
            && file.buffer[1] === 0xd8
            && file.buffer[2] === 0xff;
    }
    if (extension === '.mp4') {
        return file.buffer.length >= 8 && file.buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    }
    return false;
}

function validateMetadata(req, file) {
    const title = req.body.title?.trim();
    const category = req.body.category?.trim().toLowerCase();
    if (!file) return { error: 'No file uploaded' };
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMimeType = ACCEPTED_FILES.get(extension);
    if (!expectedMimeType || expectedMimeType !== file.mimetype || !hasExpectedSignature(file, extension)) {
        return { error: 'Invalid file type. Allowed: .png, .jpg, .jpeg, .mp4' };
    }
    if (!title) return { error: 'Media title is required' };
    if (!CATEGORIES.has(category)) return { error: 'Media category must be paid, retailer, internal, or fallback' };

    const uploadMetadata = resolveUploadMetadata(req, category);
    if (!uploadMetadata) return { status: 403, error: 'This role cannot upload media in the selected category' };
    if (!APPROVAL_STATES.has(uploadMetadata.approvalStatus)) return { error: 'Approval status is required' };

    const expectedOwnerType = category === 'paid'
        ? 'brand'
        : category === 'retailer'
            ? 'retailer'
            : 'platform';
    if (uploadMetadata.ownerType !== expectedOwnerType) {
        return { error: `${category} media must use ${expectedOwnerType} ownership` };
    }
    if ((expectedOwnerType === 'brand' || expectedOwnerType === 'retailer') && !uploadMetadata.ownerId) {
        return { error: `Owner ID is required for ${category} media` };
    }
    if (expectedOwnerType === 'platform' && uploadMetadata.ownerId) {
        return { error: `${category} media cannot have an organization owner` };
    }

    if (file.mimetype === 'video/mp4' && !req.body.duration) {
        return { error: 'Asset duration must be exactly 5 seconds for video files' };
    }
    const duration = Number(req.body.duration || 5);
    if (!Number.isFinite(duration) || duration !== 5) {
        return { error: 'Asset duration must be exactly 5 seconds' };
    }

    return { title, category, duration, ...uploadMetadata };
}

router.get('/', async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        if (!PLATFORM_MEDIA_ROLES.has(role) && role !== ROLES.BRAND) return res.json([]);
        if (!mediaRepository.isDurable()) {
            return res.status(503).json({ error: 'Persistent media metadata is unavailable' });
        }
        const assets = await mediaRepository.findAllDurable();
        if (role === ROLES.BRAND) {
            const ownerId = req.user.linked_entity_id || req.user.organization_id;
            return res.json(assets.filter(asset => asset.owner_type === 'brand' && asset.owner_id === ownerId));
        }
        return res.json(assets);
    } catch {
        return res.status(500).json({ error: 'Media could not be loaded' });
    }
});

router.post('/upload', receiveFile, async (req, res) => {
    const metadata = validateMetadata(req, req.file);
    if (metadata.error) return res.status(metadata.status || 400).json({ error: metadata.error });
    if (!mediaRepository.isDurable()) {
        return res.status(503).json({ error: 'Persistent media metadata is unavailable; no success was recorded' });
    }

    const id = `ast_${randomUUID()}`;
    const extension = path.extname(req.file.originalname).toLowerCase();
    const destination = `phase-1-demo/uploads/${id}${extension}`;
    let storedObject = null;

    try {
        storedObject = await uploadMediaObject({
            destination,
            buffer: req.file.buffer,
            contentType: req.file.mimetype,
            metadata: { mediaCategory: metadata.category, assetId: id },
        });

        const asset = await mediaRepository.create(id, {
            id,
            title: metadata.title,
            filename: req.file.originalname,
            category: metadata.category,
            content_kind: metadata.category === 'fallback' ? 'neutral_fallback' : 'campaign',
            owner_type: metadata.ownerType,
            owner_id: metadata.ownerId,
            approval_status: metadata.approvalStatus,
            eligible_for_playback: metadata.approvalStatus === 'approved',
            duration: metadata.duration,
            mime_type: req.file.mimetype,
            file_type: req.file.mimetype,
            size_bytes: req.file.size,
            storage_path: storedObject.storage_path,
            url: storedObject.url,
            status: 'ready',
        });
        return res.status(201).json(asset);
    } catch (error) {
        if (storedObject?.storage_path) {
            try {
                await deleteMediaObject(storedObject.object_ref);
            } catch (cleanupError) {
                console.error('[Media] Failed to clean up object after metadata failure', cleanupError);
            }
        }
        console.error('[Media] Upload failed', error);
        return res.status(500).json({ error: 'Media could not be saved; no success was recorded' });
    }
});

export default router;
