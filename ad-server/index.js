import express from 'express';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;
const PROJECT_ID = process.env.PROJECT_ID || 'softomedia-live-2026';

console.log(`Starting ad-server on port ${PORT} in project ${PROJECT_ID}`);

if (!JWT_SECRET) {
    // Do NOT exit — server must bind to PORT before Cloud Run considers revision healthy.
    // Auth routes will return 500 if JWT_SECRET is missing.
    console.error('WARNING: JWT_SECRET is not defined. Auth endpoints will fail. Check --set-secrets in cloudbuild.yaml.');
}

const firestore = new Firestore({ projectId: PROJECT_ID });

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
        console.warn('Bootstrap skipped: ADMIN_EMAIL or ADMIN_PASS not defined.');
        return;
    }
    try {
        const usersRef = firestore.collection('users');
        const snapshot = await usersRef.where('email', '==', ADMIN_EMAIL).get();
        if (snapshot.empty) {
            console.log('Bootstrapping Admin User...');
            const hashedPassword = await hashPassword(ADMIN_PASS);
            await usersRef.doc('admin_001').set({
                email: ADMIN_EMAIL,
                password: hashedPassword,
                role: 'admin',
                created_at: new Date().toISOString(),
                status: 'active'
            });
            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user already exists.');
        }
    } catch (error) {
        console.error('Failed to bootstrap admin:', error);
    }
}

// --- ROUTES ---
import screensRouter from './src/api/screens.js';
import playlistRouter from './src/api/playlist.js';
import adsRouter from './src/api/ads.js';
import authRouter from './src/api/auth.js';
import usersRouter from './src/api/users.js';
import dashboardRouter from './src/api/dashboard.js';
import campaignsRouter from './src/api/campaigns.js';
import schedulesRouter from './src/api/schedules.js';
import notificationsRouter from './src/api/notifications.js';
import { generalLimiter, authLimiter, uploadLimiter } from './src/middleware/rateLimiter.js';

// Rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/campaigns/create', uploadLimiter);
app.use('/api', generalLimiter);

app.use('/api/screens', screensRouter);
app.use('/api/playlist', playlistRouter);
app.use('/api/ads', adsRouter);
app.use('/api/auth', authRouter);   // <-- single authoritative login handler lives here
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/notifications', notificationsRouter);

// --- DEBUG SEED ROUTE ---
// Seeds the same 4 demo personas as seed.js (password: 'password').
// All users can switch between any persona from the dashboard without re-login.
app.get('/api/debug/seed', async (req, res) => {
    try {
        const db = new Firestore();
        console.log('Seeding Demo Data via Endpoint...');
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
                console.log(`Created user: ${u.email}`);
            } else {
                console.log(`User already exists: ${u.email}`);
            }
        }

        // Seed core supporting data
        await db.collection('advertisers').doc('adv_001').set({ name: 'TechGear Electronics', contact_email: 'marketing@techgear.com', status: 'active', created_at: new Date().toISOString() });
        await db.collection('retailers').doc('ret_001').set({ name: 'Metro Supermarkets', contact_email: 'admin@metrosuper.com', status: 'active', created_at: new Date().toISOString() });
        await db.collection('screens').doc('scr_001_01').set({ screen_id: 'scr_001_01', name: 'Main Lobby Screen', status: 'online', retailer_id: 'ret_001', store_id: 'str_001', last_seen: new Date().toISOString() });
        await db.collection('campaigns').doc('cmp_001').set({ advertiser_id: 'adv_001', name: 'TechGear Summer Sale', status: 'live', budget: 5000, spent: 1250, start_date: '2026-01-01', end_date: '2026-12-31', created_at: new Date().toISOString() });

        res.json({ status: 'seeded', message: 'Demo data seeded. All 4 personas use password: password' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (req, res) => res.status(200).send('SoftoMedia Ad Server Online'));
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});

bootstrapAdmin().catch(console.error);
