import { BaseRepository } from './BaseRepository.js';

export class PlaylistRepository extends BaseRepository {
    constructor() {
        super('playlists');
    }

    /**
     * Find active playlists assigned to a specific screen.
     * S17-6: query uses lowercase 'active' (was 'ACTIVE'). Closes RISK-S16-9.
     * Run backfill-playlist-status.js in staging then production before promoting
     * this change if pre-S13 documents with uppercase 'ACTIVE' exist in Firestore.
     * @param {string} screenId
     * @returns {Promise<Array>}
     */
    async findActiveByScreen(screenId) {
        // Fetch all active playlists
        const all = await this.findAll({
            where: [['status', '==', 'active']]
        });

        // Filter by assignment (Direct Screen ID or 'ALL')
        // In a real implementation, this might include Group logic
        return all.filter(p =>
            (p.assignments && p.assignments.includes(screenId)) ||
            (p.assignments && p.assignments.includes('ALL'))
        );
    }

    /**
     * Find the active global playlist (system-wide fallback).
     * S17-6: query uses lowercase 'active' (was 'ACTIVE'). Closes RISK-S16-9.
     * @returns {Promise<object|null>}
     */
    async findGlobalPlaylist() {
        const all = await this.findAll({
            where: [['status', '==', 'active']]
        });
        const global = all.find(p => p.is_global === true) || null;
        console.log(`[PlaylistRepo] findGlobalPlaylist: found=${!!global}, totalActive=${all.length}`);
        return global;
    }
}

export const playlistRepository = new PlaylistRepository();
