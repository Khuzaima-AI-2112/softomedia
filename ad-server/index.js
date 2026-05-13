// --- Structured Logger ---
// Outputs JSON compatible with Google Cloud Logging severity parsing.
// Levels: DEFAULT, DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL
const log = {
    info:  (msg, data = {}) => console.log(JSON.stringify({ severity: 'INFO',    message: msg, ...data, timestamp: new Date().toISOString() })),
    warn:  (msg, data = {}) => console.warn(JSON.stringify({ severity: 'WARNING', message: msg, ...data, timestamp: new Date().toISOString() })),
    error: (msg, data = {}) => console.error(JSON.stringify({ severity: 'ERROR',  message: msg, ...data, timestamp: new Date().toISOString() })),
    debug: (msg, data = {}) => console.log(JSON.stringify({ severity: 'DEBUG',   message: msg, ...data, timestamp: new Date().toISOString() })),
};

process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', { reason: String(reason) });
});

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;
const PROJECT_ID = process.env.PROJECT_ID || 'softomedia-live-2026';

log.info('Starting ad-server', { port: PORT, project: PROJECT_ID });

if (!JWT_SECRET) {
    log.warn('JWT_SECRET is not defined — auth endpoints will fail. Check --set-secrets in cloudbuild.yaml.');
}

// --- Request logging middleware ---
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const severity = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';
        console.log(JSON.stringify({
            severity,
            message: 'HTTP request',
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: duration,
            userAgent: req.headers['user-agent'] || '',
            timestamp: new Date().toISOString(),
        }));
    });
    next();
});

import { getFirestore } from './src/utils/firestore.js';
const firestore = getFirestore();

const hashPassword = async (password) => bcrypt.hash(password, 10);

const generateToken = (user) => {
    if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured on this instance.');
    return jwt.sign(
        { uid: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// --- BOOTSTRAP ADMIN ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS = process.env.ADMIN_PASS;

async function bootstrapAdmin() {
    if (!ADMIN_EMAIL || !ADMIN_PASS) {
        log.warn('Bootstrap skipped: ADMIN_EMAIL or ADMIN_PASS not defined.');
        return;
    }
    if (!firestore) {
        log.error('Bootstrap skipped: Firestore is not available.');
        return;
    }
    try {
        const usersRef = firestore.collection('users');
        const snapshot = await usersRef.where('email', '==', ADMIN_EMAIL).get();
        if (snapshot.empty) {
            log.info('Bootstrapping admin user...');
            const hashedPassword = await hashPassword(ADMIN_PASS);
            await usersRef.doc('admin_001').set({
                email: ADMIN_EMAIL,
                password: hashedPassword,
                role: 'admin',
                created_at: new Date().toISOString(),
                status: 'active'
            });
            log.info('Admin user created successfully.');
        } else {
            log.info('Admin user already exists — skipping bootstrap.');
        }
    } catch (error) {
        log.error('Failed to bootstrap admin', { error: error.message, stack: error.stack });
    }
}

// --- ROUTES ---
// Sprint 1-5 (original)
import screensRouter from './src/api/screens.js';
import playlistRouter from './src/api/playlist.js';
import adsRouter from './src/api/ads.js';
import authRouter from './src/api/auth.js';
import usersRouter from './src/api/users.js';
import dashboardRouter from './src/api/dashboard.js';
import campaignsRouter from './src/api/campaigns.js';
import schedulesRouter from './src/api/schedules.js';
import notificationsRouter from './src/api/notifications.js';

// Sprint 6: register previously unmounted routes
import retailersRouter from './src/api/retailers.js';
import storesRouter from './src/api/stores.js';
import advertisersRouter from './src/api/advertisers.js';
import locationsRouter from './src/api/locations.js';
import loopsRouter from './src/api/loops.js';
import healthRouter from './src/api/health.js';
import auditRouter from './src/api/audit.js';
import ticketsRouter from './src/api/tickets.js';
import telemetryRouter from './src/api/telemetry.js';
import monitoringRouter from './src/api/monitoring.js';
import assetsRouter from './src/api/assets.js';
import playlistsRouter from './src/api/playlists.js';
import pricingRouter from './src/api/pricing.js';
import opsRouter from './src/api/ops.js';

import { generalLimiter, authLimiter, uploadLimiter } from './src/middleware/rateLimiter.js';

// Rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/campaigns/create', uploadLimiter);
app.use('/api', generalLimiter);

// Sprint 1-5 routes
app.use('/api/screens', screensRouter);
app.use('/api/playlist', playlistRouter);
app.use('/api/ads', adsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/notifications', notificationsRouter);

// Sprint 6 routes — newly registered
app.use('/api/retailers', retailersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/advertisers', advertisersRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/loops', loopsRouter);
app.use('/api/health', healthRouter);
app.use('/api/audit', auditRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/ops', opsRouter);

// --- DEBUG SEED ROUTE ---
app.get('/api/debug/seed', async (req, res) => {
    try {
        const db = firestore;
        if (!db) {
            log.error('Seed endpoint: Firestore is not available.');
            return res.status(503).json({ error: 'Firestore is not available.' });
        }
        log.info('Seeding demo data via endpoint...');
        const hashedPassword = await hashPassword('password');
        const usersRef = db.collection('users');

        const demoUsers = [
            { id: 'admin_001',      email: 'admin@demo.com',      role: 'admin',    name: 'Global Admin',      status: 'active' },
            { id: 'retailer_001',   email: 'retailer@demo.com',   role: 'retailer', name: 'Retailer Admin',    linked_entity_id: 'ret_001', status: 'active' },
            { id: 'advertiser_001', email: 'advertiser@demo.com', role: 'brand',    name: 'Brand Manager',     linked_entity_id: 'adv_001', status: 'active' },
            { id: 'tech_001',       email: 'tech@demo.com',       role: 'tech',     name: 'Technical Support', status: 'active' },
        ];

        for (const u of demoUsers) {
            const snap = await usersRef.where('email', '==', u.email).limit(1).get();
            if (snap.empty) {
                await usersRef.doc(u.id).set({ ...u, password: hashedPassword, created_at: new Date().toISOString() });
                log.info('Seed: created user', { email: u.email, role: u.role });
            } else {
                log.debug('Seed: user already exists', { email: u.email });
            }
        }

        await db.collection('advertisers').doc('adv_001').set({ name: 'TechGear Electronics', contact_email: 'marketing@techgear.com', status: 'active', created_at: new Date().toISOString() });
        await db.collection('retailers').doc('ret_001').set({ name: 'Metro Supermarkets', contact_email: 'admin@metrosuper.com', status: 'active', created_at: new Date().toISOString() });
        await db.collection('screens').doc('scr_001_01').set({ screen_id: 'scr_001_01', name: 'Main Lobby Screen', status: 'online', retailer_id: 'ret_001', store_id: 'str_001', last_seen: new Date().toISOString() });
        await db.collection('campaigns').doc('cmp_001').set({ advertiser_id: 'adv_001', name: 'TechGear Summer Sale', status: 'live', budget: 5000, spent: 1250, start_date: '2026-01-01', end_date: '2026-12-31', created_at: new Date().toISOString() });

        log.info('Seed completed successfully.');
        res.json({ status: 'seeded', message: 'Demo data seeded. All 4 personas use password: password' });
    } catch (e) {
        log.error('Seed endpoint failed', { error: e.message, stack: e.stack });
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (req, res) => res.status(200).send('SoftoMedia Ad Server Online'));
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, '0.0.0.0', () => {
    log.info('Server ready', { port: PORT, project: PROJECT_ID, env: process.env.NODE_ENV || 'development' });
});

bootstrapAdmin().catch((err) => log.error('bootstrapAdmin failed', { error: err.message }));
