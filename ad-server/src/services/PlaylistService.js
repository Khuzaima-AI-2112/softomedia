import { adRepository, playlistRepository, mediaRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';

const PLAYLIST_CACHE = new Map();
let CACHE_HOUR = null;

export class PlaylistService {
    /**
     * Generate a playlist for a specific screen
     * @param {string} screenId 
     * @returns {Promise<object>} { playlist }
     */
    async getPlaylistForScreen(screenId) {
        // --- PHASE 3: PLAYLIST ORCHESTRATION ---

        // 1. Check for explicitly assigned active playlists
        const activePlaylists = await playlistRepository.findActiveByScreen(screenId);

        // For MVP, just take the first one. Future: Merge/Schedule logic.
        const assigned = activePlaylists[0];

        if (assigned && assigned.items?.length > 0) {
            try {
                // Hydrate items with Media URLs
                const playlist = await Promise.all(assigned.items.map(async (item) => {
                    const media = await mediaRepository.findById(item.media_id);

                    // Resolution Strategy for Content URL:
                    // 1. Explicit URL on media object
                    // 2. Local Asset serve path
                    // 3. Fallback Placeholder
                    let url = media?.url || media?.content_url;
                    if (!url && media?.filename) {
                        // Assuming local serve for Phase 3 MVP
                        url = `http://localhost:8080/assets/${media.filename}`;
                    }
                    if (!url) {
                        url = `https://placehold.co/1920x1080?text=${encodeURIComponent(media?.filename || 'Missing Asset')}`;
                    }

                    return {
                        id: item.media_id,
                        title: media?.filename || item.filename || 'Untitled Media',
                        url,
                        duration: parseInt(item.duration) || parseInt(media?.duration) || 10,
                        campaign_id: assigned.id, // Track Playlist ID as Campaign for telemetry
                        type: media?.file_type || 'image/jpeg'
                    };
                }));

                // Sort by order
                playlist.sort((a, b) => (a.order || 0) - (b.order || 0));

                logger.info('Served Scheduled Playlist', { screenId, playlistId: assigned.id });

                return {
                    screen_id: screenId,
                    source: 'playlist',
                    playlist_id: assigned.id,
                    playlist_name: assigned.name,
                    playlist
                };
            } catch (err) {
                logger.error('Failed to hydrate playlist', { error: err.message });
                // Fallthrough to legacy on error
            }
        }

        // --- GLOBAL PLAYLIST FALLBACK ---
        const globalPlaylist = await playlistRepository.findGlobalPlaylist();
        logger.info('Global Fallback Check', {
            screenId,
            found: !!globalPlaylist,
            itemCount: globalPlaylist?.items?.length || 0
        });

        if (globalPlaylist && globalPlaylist.items?.length > 0) {
            try {
                const playlist = await Promise.all(globalPlaylist.items.map(async (item) => {
                    const media = await mediaRepository.findById(item.media_id);
                    let url = media?.url || media?.content_url;
                    if (!url && media?.filename) {
                        url = `http://localhost:8080/assets/${media.filename}`;
                    }
                    if (!url) {
                        url = `https://placehold.co/1920x1080?text=${encodeURIComponent(media?.filename || 'Global Asset')}`;
                    }

                    return {
                        id: item.media_id,
                        title: media?.filename || 'Global Media',
                        url,
                        duration: 5, // Forced 5-second rotation for Global Playlist
                        campaign_id: globalPlaylist.id,
                        type: media?.file_type || 'image/jpeg'
                    };
                }));

                logger.info('Served Global Playlist', { screenId, playlistId: globalPlaylist.id });

                return {
                    screen_id: screenId,
                    source: 'global_playlist',
                    playlist_id: globalPlaylist.id,
                    playlist_name: globalPlaylist.name,
                    playlist
                };
            } catch (err) {
                logger.error('Failed to hydrate global playlist', {
                    error: err.message,
                    playlistId: globalPlaylist.id,
                    stack: err.stack
                });
            }
        }

        // --- LEGACY LOGIC (Random Ad Rotation) ---

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
