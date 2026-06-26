// Load environment variables from .env.development (parent directory)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { validateEnv } from './src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.development') });

const env = validateEnv();

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { requestLogger } from './src/utils/logger.js';

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Cloud Run Load Balancer)

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// Priority order for allowed origins:
//   1. CORS_ORIGINS env var (comma-separated, set in Cloud Run)
//   2. Hard-coded Cloud Run client-app URLs (covers the deployed app
//      even before the env var is set, so the app always works post-deploy)
//   3. Local dev origins
// ---------------------------------------------------------------------------
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

// Known Cloud Run client-app origins — keeps CORS working even if the
// env var hasn't been set in the Cloud Run revision yet.
const KNOWN_CLOUD_RUN_ORIGINS = [
    'https://client-app-524693967756.us-central1.run.app',
];

let CORS_ORIGINS;
if (process.env.CORS_ORIGINS) {
    CORS_ORIGINS = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
} else if (process.env.NODE_ENV === 'production') {
    // In production with no env var, still allow the known client-app URL
    CORS_ORIGINS = KNOWN_CLOUD_RUN_ORIGINS;
} else {
    CORS_ORIGINS = DEV_ORIGINS;
}

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (Postman, mobile apps, server-to-server)
        if (!origin) return callback(null, true);

        const allowed =
            CORS_ORIGINS.includes('*') ||
            CORS_ORIGINS.includes(origin) ||
            KNOWN_CLOUD_RUN_ORIGINS.includes(origin) ||
            (process.env.NODE_ENV !== 'production' && DEV_ORIGINS.includes(origin));

        if (allowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-demo-role'],
};

// Handle CORS pre-flight for ALL routes
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));

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
console.log('[Server] CORS origins:', CORS_ORIGINS);
console.log('[Server] Using Firestore for data persistence');

import { cacheControl } from './src/middleware/performance.js';
import apiRouter from './src/api/index.js';
import { seedDatabase } from './src/services/SeedService.js';
import { initCronJobs } from './src/utils/cron.js';

// Auto-seed runs inside listen() so Jest test imports don't trigger it.
// (Jest imports `app` without calling listen — seed must not fire at module load time.)

// Boot up automated Cron tasks (e.g., MVP D-1 Loop Generators)
initCronJobs();

// Domain API Routes
app.use('/api', apiRouter);

// [Security] Isolated AI Ghost API
import ghostRouter from './routes/ghost-api.js';
app.use('/ghost-api', ghostRouter);

// Serve assets with caching (1 hour)
app.use('/assets', cacheControl(3600), express.static('assets'));

app.get('/api/debug/seed', (req, res) => {
    res.json({ status: 'seeded', message: 'In-memory database is ready.' });
});

// Health check endpoint for Docker/Cloud Run
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.get('/', (req, res) => res.send('SoftoMedia Ad Server Online'));

// Error handling
import { errorHandler } from './src/middleware/error.js';
app.use(errorHandler);

// Only bind the port for a real server boot.
// When Jest imports `app` via supertest, JEST_WORKER_ID is set — skip listen()
// entirely to prevent EADDRINUSE on parallel test suites.
if (!process.env.JEST_WORKER_ID) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        if (process.env.NODE_ENV !== 'production') {
            seedDatabase();
        }
    });
}

export default app;

