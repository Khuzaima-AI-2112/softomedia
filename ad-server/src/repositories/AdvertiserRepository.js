import { BaseRepository } from './BaseRepository.js';

export class AdvertiserRepository extends BaseRepository {
    constructor() {
        super('advertisers');
    }
}

export const advertiserRepository = new AdvertiserRepository();
