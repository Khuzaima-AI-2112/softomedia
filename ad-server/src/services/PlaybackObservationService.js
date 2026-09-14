import {
    playbackObservationRepository,
    screenRepository,
} from '../repositories/index.js';
import { playbackService, PlaybackError } from './PlaybackService.js';
import { PresentationEventError, validatePresentationMetadata } from './PresentationEventValidation.js';

const PRESENTATION_TYPES = new Set(['fallback', 'holding_slide']);

export class PlaybackObservationService {
    async record(body) {
        const required = [
            'event_id',
            'screen_id',
            'location_id',
            'presentation_type',
            'presentation_started_at',
            'intended_duration_seconds',
        ];
        const missingFields = required.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
        if (missingFields.length > 0) {
            throw new PresentationEventError('Invalid playback observation', 400, { missing_fields: missingFields });
        }
        if (!PRESENTATION_TYPES.has(body.presentation_type)) {
            throw new PresentationEventError('Only fallback and Holding Slide observations are accepted', 400);
        }
        const presentationStartedAt = validatePresentationMetadata(body);
        const screen = await screenRepository.findById(body.screen_id);
        if (!screen) throw new PresentationEventError('Screen not found', 404);
        if (screen.location_id !== body.location_id) {
            throw new PresentationEventError('Screen is not assigned to the supplied Location');
        }
        let playback;
        try {
            playback = await playbackService.getForScreen(body.screen_id, presentationStartedAt);
        } catch (error) {
            if (error instanceof PlaybackError) {
                throw new PresentationEventError(error.message, error.status);
            }
            throw error;
        }

        if (body.presentation_type === 'fallback') {
            if (!Number.isInteger(body.slot_position) || body.slot_position < 0) {
                throw new PresentationEventError('slot_position must be a non-negative integer', 400);
            }
            const slot = playback.slots?.find(candidate => candidate.position === body.slot_position);
            if (playback.loop_id !== body.loop_id
                || slot?.presentation_type !== 'fallback'
                || slot?.asset_id !== body.asset_id) {
                throw new PresentationEventError('The fallback Slot was not assigned for playback at the supplied time');
            }
        } else {
            if (playback.playback_mode !== 'holding_slide') {
                throw new PresentationEventError(
                    'Holding Slide playback is not valid while an approved schedule is available',
                    422,
                );
            }
        }

        return playbackObservationRepository.record({
            event_id: body.event_id,
            screen_id: body.screen_id,
            location_id: body.location_id,
            loop_id: body.loop_id || null,
            slot_position: Number.isInteger(body.slot_position) ? body.slot_position : null,
            asset_id: body.asset_id || null,
            presentation_type: body.presentation_type,
            presentation_started_at: body.presentation_started_at,
            intended_duration_seconds: body.intended_duration_seconds,
            timestamp: body.presentation_started_at,
        });
    }
}

export const playbackObservationService = new PlaybackObservationService();
