import { BaseRepository } from './BaseRepository.js';

export class RetailerRepository extends BaseRepository {
    constructor() {
        super('retailers');
    }
}

export const retailerRepository = new RetailerRepository();
