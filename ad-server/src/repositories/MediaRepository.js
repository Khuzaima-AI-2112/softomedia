import { BaseRepository } from './BaseRepository.js';

export class MediaRepository extends BaseRepository {
    constructor() {
        super('media');
    }
}

export const mediaRepository = new MediaRepository();
