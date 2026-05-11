import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { generateSignedUrl } from '../utils/storage.js';

const router = express.Router();
const firestore = new Firestore();
const adsCollection = firestore.collection('ads');

// GET /api/ads
// List all ads with stats and signed URLs for thumbnails
router.get('/', async (req, res) => {
    try {
        const snapshot = await adsCollection.get();
        const ads = [];

        for (const doc of snapshot.docs) {
            const adData = doc.data();
            // Generate Signed URL for thumbnail
            // Use the same storage path logic as playlist
            const signedUrl = await generateSignedUrl(adData.storage_path);

            ads.push({
                id: doc.id,
                ...adData,
                thumbnail_url: signedUrl
            });
        }

        res.json({ ads });
    } catch (error) {
        console.error('Error fetching ads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
