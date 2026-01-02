import { BaseRepository } from './BaseRepository.js';

export class AdRepository extends BaseRepository {
    constructor() {
        super('ads');
    }
}

export const adRepository = new AdRepository();
