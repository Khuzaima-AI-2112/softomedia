import {
    campaignRepository,
    impressionRepository,
    loopRepository,
    screenRepository,
} from '../repositories/index.js';
import { playbackService, PlaybackError } from './PlaybackService.js';
import { PresentationEventError as ProofOfPlayError, validatePresentationMetadata } from './PresentationEventValidation.js';

export { PresentationEventError as ProofOfPlayError } from './PresentationEventValidation.js';

export const PROOF_OF_PLAY_FIELDS = Object.freeze([
    'event_id',
    'screen_id',
    'location_id',
    'loop_id',
    'slot_position',
    'campaign_id',
    'asset_id',
    'presentation_started_at',
    'intended_duration_seconds',
]);

function isMissing(body, field) {
    const value = body[field];
    if (field === 'slot_position' || field === 'intended_duration_seconds') {
        return value === undefined || value === null;
    }
    return typeof value !== 'string' || value.trim() === '';
}

export class ProofOfPlayService {
    async record(body) {
        const missingFields = PROOF_OF_PLAY_FIELDS.filter(field => isMissing(body, field));
        if (missingFields.length > 0) {
            throw new ProofOfPlayError('Invalid Proof of Play', 400, { missing_fields: missingFields });
        }
        if (!Number.isInteger(body.slot_position) || body.slot_position < 0) {
            throw new ProofOfPlayError('slot_position must be a non-negative integer', 400);
        }
        const presentationStartedAt = validatePresentationMetadata(body);

        const [screen, loop, campaign] = await Promise.all([
            screenRepository.findById(body.screen_id),
            loopRepository.findById(body.loop_id),
            campaignRepository.findById(body.campaign_id),
        ]);
        if (!screen) throw new ProofOfPlayError('Screen not found', 404);
        if (!loop) throw new ProofOfPlayError('Hourly Loop not found', 404);
        if (!campaign) throw new ProofOfPlayError('Campaign not found', 404);
        if (screen.location_id !== body.location_id) {
            throw new ProofOfPlayError('Screen is not assigned to the supplied Location');
        }
        if (loop.status !== 'approved') {
            throw new ProofOfPlayError('Hourly Loop is not approved');
        }
        if (Array.isArray(loop.screen_ids) && loop.screen_ids.length > 0 && !loop.screen_ids.includes(body.screen_id)) {
            throw new ProofOfPlayError('Hourly Loop is not assigned to the supplied Screen');
        }

        const slot = (loop.slots || []).find(candidate => candidate?.position === body.slot_position);
        const isCampaignDelivery = slot
            && slot.content_kind === 'campaign'
            && slot.is_fallback !== true
            && slot.campaign_id === body.campaign_id
            && slot.asset_id === body.asset_id;
        if (!isCampaignDelivery) {
            throw new ProofOfPlayError('The presented Slot is not Campaign delivery');
        }
        if (slot.duration && slot.duration !== body.intended_duration_seconds) {
            throw new ProofOfPlayError('intended_duration_seconds does not match the scheduled Slot');
        }

        let playback;
        try {
            playback = await playbackService.getForScreen(body.screen_id, presentationStartedAt);
        } catch (error) {
            if (error instanceof PlaybackError) {
                throw new ProofOfPlayError(error.message, error.status);
            }
            throw error;
        }
        const presentedSlot = playback.slots?.find(candidate => candidate.position === body.slot_position);
        if (playback.loop_id !== body.loop_id
            || presentedSlot?.presentation_type !== 'campaign'
            || presentedSlot?.campaign_id !== body.campaign_id
            || presentedSlot?.asset_id !== body.asset_id) {
            throw new ProofOfPlayError('The Campaign Slot was not assigned for playback at the supplied time');
        }

        const event = Object.fromEntries(PROOF_OF_PLAY_FIELDS.map(field => [field, body[field]]));
        return impressionRepository.recordProofOfPlay(event, campaignRepository);
    }
}

export const proofOfPlayService = new ProofOfPlayService();
