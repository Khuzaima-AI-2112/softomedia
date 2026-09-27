import express from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { campaignRepository, mediaRepository } from '../repositories/index.js';
import { loopRepository } from '../repositories/LoopRepository.js';
import { deleteMediaObject, uploadMediaObject } from '../utils/storage.js';
import { ROLES, normalizeRole } from '../constants/roles.js';
import { sendMediaContent } from './mediaContent.js';
import { assetContentPath } from '../constants/mediaPaths.js';
import { decodeUploadFilename } from '../utils/uploadFilename.js';
import { readMediaHeader } from '../utils/mediaHeaders.js';

const router = express.Router();
const CATEGORIES = new Set(['paid', 'retailer', 'internal', 'fallback']);
const APPROVAL_STATES = new Set(['approved', 'pending_approval', 'rejected']);
const ACCEPTED_FILES = new Map([
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.mp4', 'video/mp4'],
    ['.mov', 'video/quicktime'],
]);
const PLATFORM_MEDIA_ROLES = new Set([ROLES.ADMIN, ROLES.SUPERADMIN]);
const MAXIMUM_FILE_BYTES = 20 * 1024 * 1024;
const SLOT_SECONDS = 5;
const DURATION_TOLERANCE_SECONDS = 0.1;
const WIDESCREEN = 16 / 9;
const FRAME_TOLERANCE = 0.01;
const MINIMUM_WIDTH = 1280;
const MINIMUM_HEIGHT = 720;
// A QuickTime file opens with one of these boxes; older files have no 'ftyp'.
const QUICKTIME_FIRST_BOXES = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);
const PNG_SIGNATURE =Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAXIMUM_FILE_BYTES, fieldSize: 2 * 1024 * 1024, files: 1 },
});

function receiveFile(req, res, next) {
    upload.single('file')(req, res, error => {
        if (!error) {
            if (req.file) req.file.originalname = decodeUploadFilename(req.file.originalname);
            return next();
        }
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'File must be 20 MB or smaller'
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
    if (extension === '.mov') {
        return file.buffer.length >= 8 && QUICKTIME_FIRST_BOXES.has(file.buffer.subarray(4, 8).toString('ascii'));
    }
    return false;
}

/** Why a frame can't be shown on a Screen, or null when it can. */
function checkFrame({ width, height }) {
    const size = `${Math.round(width)}×${Math.round(height)}`;
    if (!height || Math.abs(width / height / WIDESCREEN - 1) > FRAME_TOLERANCE) {
        return `Media must be 16:9; this file is ${size}`;
    }
    if (width < MINIMUM_WIDTH || height < MINIMUM_HEIGHT) {
        return `Media must be at least ${MINIMUM_WIDTH}×${MINIMUM_HEIGHT}; this file is ${size}`;
    }
    return null;
}

/**
 * The file's duration and frame, read from its own header. A still image plays
 * for one five-second Slot; the duration a client declares is ignored.
 */
function measureMedia(file, extension) {
    const isVideo = file.mimetype.startsWith('video/');
    const header = readMediaHeader(file.buffer, extension);
    if (!header) {
        return { error: isVideo
            ? 'The video could not be read. Upload a playable .mp4 or .mov file'
            : 'The image could not be read. Upload a valid .png, .jpg or .jpeg file' };
    }
    if (isVideo && Math.abs(header.duration - SLOT_SECONDS) > DURATION_TOLERANCE_SECONDS) {
        return { error: `A video must last 5 seconds (±0.1 s); this one lasts ${header.duration.toFixed(1)} s` };
    }
    const frameError = checkFrame(header);
    if (frameError) return { error: frameError };
    return { duration: isVideo ? header.duration : SLOT_SECONDS, width: header.width, height: header.height };
}

function validateMetadata(req, file) {
    const title = req.body.title?.trim();
    const category = req.body.category?.trim().toLowerCase();
    if (!file) return { error: 'No file uploaded' };
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMimeType = ACCEPTED_FILES.get(extension);
    if (!expectedMimeType || expectedMimeType !== file.mimetype || !hasExpectedSignature(file, extension)) {
        return { error: 'Invalid file type. Allowed: .png, .jpg, .jpeg, .mp4, .mov' };
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

    const measured = measureMedia(file, extension);
    if (measured.error) return measured;

    return { title, category, ...measured, ...uploadMetadata };
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
            return res.json(assets
                .filter(asset => asset.owner_type === 'brand' && asset.owner_id === ownerId)
                .map(presentAsset));
        }
        return res.json(assets.map(presentAsset));
    } catch {
        return res.status(500).json({ error: 'Media could not be loaded' });
    }
});

/** Stored media is addressed by its API content path; its Storage location stays internal. */
function presentAsset(asset) {
    if (!asset?.storage_path) return asset;
    const presented = { ...asset, content_path: assetContentPath(asset.id) };
    delete presented.url;
    return presented;
}

/** A Retailer reviews the creative of any Campaign booked at its Stores. */
async function isUnderReviewBy(asset, retailerId) {
    if (!retailerId) return false;
    const campaigns = await campaignRepository.findAll();
    return campaigns.some(campaign => (campaign.media_id === asset.id || campaign.asset_id === asset.id)
        && campaignRepository.targetsRetailer(campaign, retailerId));
}

/** A Retailer previews any asset currently assigned to a Slot in one of its Loops. */
async function isAssignedToRetailerLoop(asset, retailerId) {
    if (!retailerId) return false;
    const loops = await loopRepository.findAll({ where: [['retailer_id', '==', retailerId]] });
    return loops.some(loop => (loop.slots || []).some(slot => slot.asset_id === asset.id));
}

/**
 * GET /api/assets/:id/content
 * The asset's file, for a signed-in user allowed to see the asset. Media that
 * is outside the caller's scope reads as not found.
 */
router.get('/:id/content', async (req, res) => {
    const asset = await mediaRepository.findById(req.params.id);
    const role = normalizeRole(req.user?.role);
    const ownerId = req.user?.organization_id || req.user?.linked_entity_id || null;
    const visible = asset && (
        PLATFORM_MEDIA_ROLES.has(role)
        || (role === ROLES.BRAND && asset.owner_type === 'brand' && asset.owner_id === ownerId)
        || (role === ROLES.RETAILERADMIN
            && (await isUnderReviewBy(asset, ownerId) || await isAssignedToRetailerLoop(asset, ownerId)))
    );
    if (!visible) return res.status(404).json({ error: 'Media not found' });
    return sendMediaContent(res, asset);
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
            width: metadata.width ?? null,
            height: metadata.height ?? null,
            mime_type: req.file.mimetype,
            file_type: req.file.mimetype,
            size_bytes: req.file.size,
            storage_path: storedObject.storage_path,
            status: 'ready',
        });
        return res.status(201).json(presentAsset(asset));
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
