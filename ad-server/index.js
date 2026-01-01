// Load environment variables from .env.development (parent directory)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.development') });

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import compression from 'compression';
import logger, { requestLogger } from './src/utils/logger.js';

const app = express();

// Environment-based CORS configuration
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (CORS_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' })); // Limit request body size

// Security headers
import { securityHeaders } from './src/middleware/security.js';
app.use(securityHeaders);

// Request logging
app.use(requestLogger);

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

// Validate required environment variables
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
    process.exit(1);
}

console.log('[Server] Environment configured successfully');
console.log('[Server] Using Firestore for data persistence');

// --- ROUTES ---


import { userRepository, adRepository, screenRepository, impressionRepository } from './src/repositories/index.js';
import { authService, playlistService } from './src/services/index.js';
import { validateLogin, validateScreenRegistration, validateImpression, validatePlaylistRequest } from './src/middleware/validation.js';
import { playlistETag, cacheControl } from './src/middleware/performance.js';

app.post('/api/auth/login', validateLogin, async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.login(email);
        res.json(result);
    } catch (error) {
        logger.error('Login error', { error: error.message, email: req.body.email });
        const status = error.message === 'User not found' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

app.get('/api/playlist/:screenId', validatePlaylistRequest, playlistETag, async (req, res) => {
    try {
        const { screenId } = req.params;
        const playlist = await playlistService.generatePlaylist(screenId);
        res.json(playlist);
    } catch (error) {
        logger.error('Playlist error', { error: error.message, screenId: req.params.screenId });
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/screens/register', validateScreenRegistration, async (req, res) => {
    try {
        const { screen_id } = req.body;
        const screen = await screenRepository.updateLastSeen(screen_id);
        res.json({ status: 'registered', data: screen });
    } catch (error) {
        logger.error('Screen registration error', { error: error.message, screen_id: req.body.screen_id });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/screens/:screenId/impressions', validateImpression, async (req, res) => {
    try {
        const { screenId } = req.params;
        const { ad_id } = req.body;
        await impressionRepository.record(screenId, ad_id);
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        logger.error('Impression recording error', { error: error.message, screenId: req.params.screenId, ad_id: req.body.ad_id });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve assets with caching (1 hour)
app.use('/assets', cacheControl(3600), express.static('assets'));

app.get('/api/debug/seed', (req, res) => {
    res.json({ status: 'seeded', message: 'In-memory database is ready.' });
});

// Health check endpoint for Docker/Cloud Run
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.get('/', (req, res) => res.send('SoftoMedia Ad Server (Mock) Online'));

app.listen(PORT, () => {
    console.log(`Mock Server listening on port ${PORT}`);
});
