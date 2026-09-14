import { BaseRepository } from './BaseRepository.js';

export class PlaybackObservationRepository extends BaseRepository {
    constructor() {
        super('playback_observations');
    }

    async record(observation) {
        const existing = await this.findById(observation.event_id);
        if (existing) return { status: 'duplicate', observation: existing };
        const persisted = await this.create(observation.event_id, observation);
        return { status: 'recorded', observation: persisted };
    }
}

export const playbackObservationRepository = new PlaybackObservationRepository();
