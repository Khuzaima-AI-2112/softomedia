import express from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { campaignRepository, CREATIVE_STATUS, creativeRepository, mediaRepository } from '../repositories/index.js';
import { loopRepository } from '../repositories/LoopRepository.js';
import { deleteMediaObject, uploadMediaObject } from '../utils/storage.js';
import { ROLES, brandIdFor, normalizeRole } from '../constants/roles.js';
import { sendMediaContent } from './mediaContent.js';
import { assetContentPath } from '../constants/mediaPaths.js';
import { decodeUploadFilename } from '../utils/uploadFilename.js';
import { readMediaHeader } from '../utils/mediaHeaders.js';
import { MAXIMUM_CREATIVE_FILES } from '../constants/creatives.js';

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
const MAXIMUM_FILE_MB = 20;
const SLOT_SECONDS = 5;
// Compared in whole milliseconds, so both edges of 5.0 s ± 0.1 s are accepted.
const DURATION_TOLERANCE_MS = 100;
const WIDESCREEN = 16 / 9;
const FRAME_TOLERANCE = 0.01;
const MINIMUM_WIDTH = 1280;
const MINIMUM_HEIGHT = 720;
// A QuickTime file opens with one of these boxes; older files have no 'ftyp'.
const QUICKTIME_FIRST_BOXES = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAXIMUM_FILE_MB * 1024 * 1024,
        fieldSize: 2 * 1024 * 1024,
        files: MAXIMUM_CREATIVE_FILES,
    },
});

/** Receives up to three `file` fields, in the order sent: a Creative's files in play order. */
function receiveFiles(req, res, next) {
    upload.array('file', MAXIMUM_CREATIVE_FILES)(req, res, error => {
        if (!error) {
            for (const file of req.files || []) file.originalname = decodeUploadFilename(file.originalname);
            return next();
        }
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? `File must be ${MAXIMUM_FILE_MB} MB or smaller`
            : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
                ? `A Creative holds at most ${MAXIMUM_CREATIVE_FILES} files`
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
            ownerId: brandIdFor(req.user),
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
function frameRefusal({ width, height }) {
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
    if (isVideo && Math.abs(Math.round(header.duration * 1000) - SLOT_SECONDS * 1000) > DURATION_TOLERANCE_MS) {
        return {
            error: `A video must last ${SLOT_SECONDS} seconds (±${DURATION_TOLERANCE_MS / 1000} s); `
                + `this one lasts ${header.duration.toFixed(1)} s`,
        };
    }
    const refusal = frameRefusal(header);
    if (refusal) return { error: refusal };
    return { duration: isVideo ? header.duration : SLOT_SECONDS, width: header.width, height: header.height };
}

/** Whether a file is an accepted type that really is what its name and type claim. */
function isAcceptedFile(file) {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMimeType = ACCEPTED_FILES.get(extension);
    return Boolean(expectedMimeType) && expectedMimeType === file.mimetype && hasExpectedSignature(file, extension);
}

/**
 * Checks each file, then the upload's metadata. Each file's measurements come
 * back in `files`, in order. A problem with one of several files names it.
 */
function validateMetadata(req, files) {
    const title = req.body.title?.trim();
    const category = req.body.category?.trim().toLowerCase();
    if (files.length === 0) return { error: 'No file uploaded' };
    const whichFile = index => (files.length > 1 ? `File ${index + 1}: ` : '');
    const rejected = files.findIndex(file => !isAcceptedFile(file));
    if (rejected !== -1) {
        return { error: `${whichFile(rejected)}Invalid file type. Allowed: .png, .jpg, .jpeg, .mp4, .mov` };
    }
    if (!title) return { error: 'Media title is required' };
    if (!CATEGORIES.has(category)) return { error: 'Media category must be paid, retailer, internal, or fallback' };
    if (files.length > 1 && category !== 'paid') return { error: 'Only a Brand’s Creative may hold several files' };

    const uploadMetadata = resolveUploadMetadata(req, category);
    if (!uploadMetadata) return { status: 403, error: 'This role cannot upload media in the selected category' };
    // Paid media is a Creative's file; its approval belongs to the Creative.
    if (category !== 'paid' && !APPROVAL_STATES.has(uploadMetadata.approvalStatus)) {
        return { error: 'Approval status is required' };
    }

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

    const measured = files.map(file => measureMedia(file, path.extname(file.originalname).toLowerCase()));
    const unmeasured = measured.findIndex(measurement => measurement.error);
    if (unmeasured !== -1) return { error: `${whichFile(unmeasured)}${measured[unmeasured].error}` };

    return { title, category, files: measured, ...uploadMetadata };
}

router.get('/', async (req, res) => {
    try {
        const role = normalizeRole(req.user?.role);
        if (!PLATFORM_MEDIA_ROLES.has(role) && role !== ROLES.BRAND) return res.json([]);
        if (!mediaRepository.isDurable()) {
            return res.status(503).json({ error: 'Persistent media metadata is unavailable' });
        }
        const [assets, creatives] = await Promise.all([
            mediaRepository.findAllDurable(),
            creativeRepository.findAll(),
        ]);
        const creativesById = new Map(creatives.map(creative => [creative.id, creative]));
        const present = asset => presentAsset(asset, creativesById.get(asset.creative_id));
        if (role === ROLES.BRAND) {
            const ownerId = req.user.linked_entity_id || req.user.organization_id;
            return res.json(assets
                .filter(asset => asset.owner_type === 'brand' && asset.owner_id === ownerId)
                .map(present));
        }
        return res.json(assets.map(present));
    } catch {
        return res.status(500).json({ error: 'Media could not be loaded' });
    }
});

/**
 * Stored media is addressed by its API content path; its Storage location stays
 * internal. A paid file carries the Creative it belongs to: its approval status
 * and all its files in play order.
 */
function presentAsset(asset, creative = null) {
    const presented = creative
        ? {
            ...asset,
            creative: { id: creative.id, approval_status: creative.approval_status, media_ids: creative.media_ids },
        }
        : asset;
    if (!presented?.storage_path) return presented;
    const addressed = { ...presented, content_path: assetContentPath(asset.id) };
    delete addressed.url;
    return addressed;
}

/** A Retailer reviews every file of the Creative of any Campaign booked at its Stores. */
async function isUnderReviewBy(asset, retailerId) {
    if (!retailerId) return false;
    const campaigns = await campaignRepository.findAll();
    return campaigns.some(campaign => (campaign.media_id === asset.id || campaign.asset_id === asset.id
        || (asset.creative_id && campaign.creative_id === asset.creative_id))
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

/**
 * POST /api/assets/upload
 * One file, or for a Brand's Creative up to three sent in play order. Every
 * file is stored as its own media record; a paid upload's files form one new
 * Creative, approved as one. Answers with the first file.
 */
router.post('/upload', receiveFiles, async (req, res) => {
    const files = req.files || [];
    const metadata = validateMetadata(req, files);
    if (metadata.error) return res.status(metadata.status || 400).json({ error: metadata.error });
    if (!mediaRepository.isDurable()) {
        return res.status(503).json({ error: 'Persistent media metadata is unavailable; no success was recorded' });
    }

    const ids = files.map(() => `ast_${randomUUID()}`);
    const storedObjects = [];
    const createdIds = [];
    let creative = null;

    try {
        for (const [index, file] of files.entries()) {
            const extension = path.extname(file.originalname).toLowerCase();
            storedObjects.push(await uploadMediaObject({
                destination: `phase-1-demo/uploads/${ids[index]}${extension}`,
                buffer: file.buffer,
                contentType: file.mimetype,
                metadata: { mediaCategory: metadata.category, assetId: ids[index] },
            }));
        }

        // Every paid upload is a new Creative, even of a file uploaded before.
        if (metadata.category === 'paid') {
            creative = await creativeRepository.create(creativeRepository.newId(), {
                brand_id: metadata.ownerId,
                media_ids: ids,
                approval_status: CREATIVE_STATUS.PENDING,
                decided_by: null,
                decided_at: null,
                reason: null,
            });
        }
        const approval = creative
            ? { creative_id: creative.id }
            : {
                approval_status: metadata.approvalStatus,
                eligible_for_playback: metadata.approvalStatus === 'approved',
            };
        const assets = [];
        for (const [index, file] of files.entries()) {
            const measured = metadata.files[index];
            assets.push(await mediaRepository.create(ids[index], {
                id: ids[index],
                title: files.length > 1 ? `${metadata.title} (${index + 1} of ${files.length})` : metadata.title,
                filename: file.originalname,
                category: metadata.category,
                content_kind: metadata.category === 'fallback' ? 'neutral_fallback' : 'campaign',
                owner_type: metadata.ownerType,
                owner_id: metadata.ownerId,
                ...approval,
                duration: measured.duration,
                width: measured.width ?? null,
                height: measured.height ?? null,
                mime_type: file.mimetype,
                file_type: file.mimetype,
                size_bytes: file.size,
                storage_path: storedObjects[index].storage_path,
                status: 'ready',
            }));
            createdIds.push(ids[index]);
        }
        return res.status(201).json(presentAsset(assets[0], creative));
    } catch (error) {
        await Promise.all(createdIds.map(id => mediaRepository.delete(id)));
        if (creative) await creativeRepository.delete(creative.id);
        for (const storedObject of storedObjects) {
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
