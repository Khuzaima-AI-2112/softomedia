import { adRepository, mediaRepository } from '../repositories/index.js';
import logger from '../utils/logger.js';

const PLAYLIST_CACHE = new Map();
let CACHE_HOUR = null;

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

        // Reset cache if hour changed
        if (CACHE_HOUR !== hour) {
            PLAYLIST_CACHE.clear();
            CACHE_HOUR = hour;
            logger.info('Playlist cache cleared for new hour', { hour, currentSlot });
        }

        // Check cache
        if (PLAYLIST_CACHE.has(currentSlot)) {
            return {
                screen_id: screenId,
                slot: currentSlot,
                playlist: PLAYLIST_CACHE.get(currentSlot),
                cached: true
            };
        }

        // Fetch ads for this slot
        const ads = await adRepository.findAll({
            where: [
                ['status', '==', 'approved'],
                ['scheduled_slot', '==', currentSlot]
            ],
            limit: 20
        });

        // Fallback: If no ads for current slot, check for ALL_DAY ads
        if (ads.length === 0) {
            // Check cache for ALL_DAY
            if (PLAYLIST_CACHE.has('ALL_DAY')) {
                return {
                    screen_id: screenId,
                    slot: 'ALL_DAY',
                    playlist: PLAYLIST_CACHE.get('ALL_DAY'),
                    cached: true
                };
            }

            const allDayAds = await adRepository.findAll({
                where: [
                    ['status', '==', 'approved'],
                    ['scheduled_slot', '==', 'ALL_DAY']
                ],
                limit: 20
            });

            if (allDayAds.length > 0) {
                const playlist = allDayAds.map(ad => ({
                    id: ad.id,
                    title: ad.title,
                    url: ad.content_url || `https://placehold.co/1920x1080?text=${encodeURIComponent(ad.title)}`,
                    duration: ad.duration || 5,
                    campaign_id: ad.campaign_id || 'cmp_demo_001'
                }));
                PLAYLIST_CACHE.set('ALL_DAY', playlist);
                return { screen_id: screenId, slot: 'ALL_DAY', playlist };
            }

            // Final fallback: placeholder (don't cache placeholder)
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

        // Store in cache
        PLAYLIST_CACHE.set(currentSlot, playlist);

        return { screen_id: screenId, slot: currentSlot, playlist };
    }
}

export const playlistService = new PlaylistService();
