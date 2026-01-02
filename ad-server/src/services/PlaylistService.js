import { adRepository, mediaRepository } from '../repositories/index.js';

export class PlaylistService {
    /**
     * Generate a playlist for a specific screen
     * @param {string} screenId 
     * @returns {Promise<object>} { playlist }
     */
    async getPlaylistForScreen(screenId) {
        // Calculate current 1hr slot (e.g., "08:00 AM")
        const now = new Date();
        const hour = now.getHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        const currentSlot = `${displayHour.toString().padStart(2, '0')}:00 ${ampm}`;

        // Fetch ads for this slot
        const ads = await adRepository.findAll({
            where: [
                ['status', '==', 'approved'],
                ['scheduled_slot', '==', currentSlot]
            ],
            limit: 20
        });

        // Fallback: If no ads for current slot, return a placeholder to avoid empty screen
        if (ads.length === 0) {
            return {
                screen_id: screenId,
                playlist: [{
                    id: 'placeholder',
                    title: 'System Default - Wait for Slot',
                    url: 'https://placehold.co/1920x1080?text=Waiting%20for%20Scheduled%20Slot',
                    duration: 10
                }]
            };
        }

        const playlist = ads.map(ad => ({
            id: ad.id,
            title: ad.title,
            url: ad.content_url || `https://placehold.co/1920x1080?text=${encodeURIComponent(ad.title)}`,
            duration: ad.duration || 5,
            campaign_id: ad.campaign_id || 'cmp_demo_001'
        }));

        return { screen_id: screenId, slot: currentSlot, playlist };
    }
}

export const playlistService = new PlaylistService();
