import { BaseRepository } from './BaseRepository.js';

export class PlaylistRepository extends BaseRepository {
    constructor() {
        super('playlists');
    }

    /**
     * Find active playlists assigned to a specific screen
     * @param {string} screenId 
     * @returns {Promise<Array>}
     */
    async findActiveByScreen(screenId) {
        // Fetch all active playlists
        const all = await this.findAll({
            where: [['status', '==', 'ACTIVE']]
        });

        // Filter by assignment (Direct Screen ID or 'ALL')
        // In a real implementation, this might include Group logic
        return all.filter(p =>
            (p.assignments && p.assignments.includes(screenId)) ||
            (p.assignments && p.assignments.includes('ALL'))
        );
    }

    /**
     * Find the active global playlist (system-wide fallback)
     * @returns {Promise<object|null>}
     */
    async findGlobalPlaylist() {
        const all = await this.findAll({
            where: [['status', '==', 'ACTIVE']]
        });
        const global = all.find(p => p.is_global === true) || null;
        console.log(`[PlaylistRepo] findGlobalPlaylist: found=${!!global}, totalActive=${all.length}`);
        return global;
    }
}

export const playlistRepository = new PlaylistRepository();
