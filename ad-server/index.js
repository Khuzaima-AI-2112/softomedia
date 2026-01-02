// Load environment variables from .env.development (parent directory)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.development') });

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { requestLogger } from './src/utils/logger.js';

const app = express();

// Environment-based CORS configuration
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : []; // Fallback to empty in production, must be explicitly set via env

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


import { cacheControl } from './src/middleware/performance.js';
import apiRouter from './src/api/index.js';
import { seedDatabase } from './src/services/SeedService.js';

// Auto-seed for development/test
seedDatabase();

// --- ROUTES ---

// Domain API Routes
app.use('/api', apiRouter);


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
