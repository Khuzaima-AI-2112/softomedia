import { BaseRepository } from './BaseRepository.js';

export class MediaRepository extends BaseRepository {
    constructor() {
        super('media');
    }

    isDurable() {
        return Boolean(this.collection);
    }

    async findAllDurable() {
        if (!this.collection) throw new Error('Firestore is unavailable');
        const snapshot = await this.breaker.execute(() => this.collection.get());
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}

export const mediaRepository = new MediaRepository();
