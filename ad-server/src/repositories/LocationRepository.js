import { BaseRepository } from './BaseRepository.js';

export class LocationRepository extends BaseRepository {
    constructor() {
        super('locations');
    }
}

export const locationRepository = new LocationRepository();
