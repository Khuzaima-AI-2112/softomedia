// Playlist Service
// Business logic for playlist generation

import { adRepository, screenRepository } from '../repositories/index.js';

export class PlaylistService {
    /**
     * Generate playlist for screen
     * @param {string} screenId - Screen ID
     * @returns {Promise<{playlist: Array}>}
     */
    async generatePlaylist(screenId) {
        // Update screen last seen
        await screenRepository.updateLastSeen(screenId);

        // Get approved ads
        const ads = await adRepository.findApproved();

        if (ads.length === 0) {
            throw new Error('No approved ads available');
        }

        // Create loop from ads
        const loop = ads.map((ad, i) => ({
            slot_number: i,
            id: ad.id,
            url: `/assets/${ad.file_path}`,
            title: ad.title,
            duration: ad.duration || 5
        }));

        // Repeat to fill 12 slots (1 minute loop at 5 seconds each)
        const fullLoop = this.fillLoop(loop, 12);

        return { playlist: fullLoop };
    }

    /**
     * Fill loop to target slot count
     * @param {Array} loop - Original loop
     * @param {number} targetSlots - Target number of slots
     * @returns {Array} Filled loop
     */
    fillLoop(loop, targetSlots) {
        if (loop.length === 0) return [];

        const result = [];
        let slotNumber = 0;

        while (result.length < targetSlots) {
            for (const ad of loop) {
                if (result.length >= targetSlots) break;
                result.push({
                    ...ad,
                    slot_number: slotNumber++
                });
            }
        }

        return result;
    }
}

// Export singleton instance
export const playlistService = new PlaylistService();
