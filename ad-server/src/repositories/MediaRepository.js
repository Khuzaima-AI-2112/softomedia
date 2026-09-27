import { BaseRepository } from './BaseRepository.js';
import { decodeUploadFilename } from '../utils/uploadFilename.js';

// Media uploaded before #20 was fixed is stored with a garbled filename.
const withUploadedFilename = asset => (asset?.filename
    ? { ...asset, filename: decodeUploadFilename(asset.filename) }
    : asset);

export class MediaRepository extends BaseRepository {
    constructor() {
        super('media');
    }

    isDurable() {
        return Boolean(this.collection);
    }

    async findById(id) {
        return withUploadedFilename(await super.findById(id));
    }

    async findAll(options = {}) {
        return (await super.findAll(options)).map(withUploadedFilename);
    }

    async findAllDurable() {
        if (!this.collection) throw new Error('Firestore is unavailable');
        const snapshot = await this.breaker.execute(() => this.collection.get());
        return snapshot.docs.map(doc => withUploadedFilename({ id: doc.id, ...doc.data() }));
    }
}

export const mediaRepository = new MediaRepository();
