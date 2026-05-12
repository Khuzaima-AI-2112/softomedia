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

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not defined.');
    process.exit(1);
}

// Initialize Firestore
const firestore = new Firestore({
    projectId: PROJECT_ID
});

// --- HELPER FUNCTIONS ---

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateToken = (user) => {
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
    try {
        const usersRef = firestore.collection('users');
        const snapshot = await usersRef.where('email', '==', ADMIN_EMAIL).get();

        if (snapshot.empty) {
            console.log('Bootstrapping Admin User...');
            const hashedPassword = await hashPassword(ADMIN_PASS);
            const newUser = {
                email: ADMIN_EMAIL,
                password_hash: hashedPassword,
                role: 'admin',
                created_at: new Date().toISOString(),
                status: 'active'
            };

            // Use email as ID for simplicity or auto-gen
            await usersRef.doc('admin_001').set(newUser);
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

// Apply rate limiters
app.use('/api/auth', authLimiter); // Strict rate limit for auth
app.use('/api/campaigns/create', uploadLimiter); // Limit uploads
app.use('/api', generalLimiter); // General rate limit for all other API routes

app.use('/api/screens', screensRouter);
app.use('/api/playlist', playlistRouter);
app.use('/api/ads', adsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/notifications', notificationsRouter);

// --- DEBUG SEED ROUTE (Remove in Prod) ---
app.get('/api/debug/seed', async (req, res) => {
    try {
        const firestore = new Firestore();
        console.log('Seeding Demo Data via Endpoint...');
        const SCREEN_ID = 'demo-screen-01';

        // 0. Create Admin User (if doesn't exist)
        const usersRef = firestore.collection('users');
        const adminSnapshot = await usersRef.where('email', '==', 'sokallel@gmail.com').get();

        if (adminSnapshot.empty) {
            console.log('Creating admin user...');
            const hashedPassword = await hashPassword('thisisbusiness');
            await usersRef.doc('admin_001').set({
                email: 'sokallel@gmail.com',
                password: hashedPassword,
                role: 'admin',
                name: 'Admin User',
                created_at: new Date().toISOString()
            });
            console.log('Admin user created');
        } else {
            console.log('Admin user already exists');
        }

        // 0b. Create Retailer User (if doesn't exist)
        const retailerSnapshot = await usersRef.where('email', '==', 'retailer@demo.com').get();
        if (retailerSnapshot.empty) {
            console.log('Creating retailer user...');
            const hashedPassword = await hashPassword('demo123');
            await usersRef.doc('retailer_001').set({
                email: 'retailer@demo.com',
                password: hashedPassword,
                role: 'retailer',
                name: 'Demo Retailer',
                linked_entity_id: SCREEN_ID, // Linked to demo screen
                status: 'active', // Free access
                created_at: new Date().toISOString()
            });
            console.log('Retailer user created');
        } else {
            console.log('Retailer user already exists');
        }

        // 0c. Create Brand User (if doesn't exist)
        const brandSnapshot = await usersRef.where('email', '==', 'brand@demo.com').get();
        if (brandSnapshot.empty) {
            console.log('Creating brand user...');
            const hashedPassword = await hashPassword('demo123');
            await usersRef.doc('brand_001').set({
                email: 'brand@demo.com',
                password: hashedPassword,
                role: 'brand',
                name: 'Demo Brand',
                linked_entity_id: 'demo_corp', // Linked to demo advertiser
                advertising_credits: 1000, // Start with 1000 credits
                status: 'active', // Free access
                created_at: new Date().toISOString()
            });
            console.log('Brand user created with 1000 advertising credits');
        } else {
            console.log('Brand user already exists');
        }


        // 1. Create Demo Advertiser
        await firestore.collection('advertisers').doc('demo_corp').set({
            name: 'Demo Corp',
            contact_email: 'demo@example.com',
            status: 'active',
            created_at: new Date().toISOString()
        });

        // 2. Create 3 Ads with Variable Durations
        // 2. Create 5 Ads with 5s Durations
        const ads = [
            { id: 'ad_001', title: 'Demo Coffee', file_path: 'demo_ad_1.png', duration: 5 },
            { id: 'ad_002', title: 'Demo Tech', file_path: 'demo_ad_2.png', duration: 5 },  // Fixed ext
            { id: 'ad_003', title: 'Demo Travel', file_path: 'demo_ad_3.png', duration: 5 }, // Fixed ext
            { id: 'ad_004', title: 'Costco', file_path: 'demo_ad_costco.png', duration: 5 },
            { id: 'ad_005', title: 'Pizza', file_path: 'demo_ad_pizza.png', duration: 5 },
        ];

        for (const ad of ads) {
            await firestore.collection('ads').doc(ad.id).set({
                advertiser_id: 'demo_corp',
                title: ad.title,
                type: 'image',
                storage_path: ad.file_path,
                duration_seconds: ad.duration,
                status: 'active',
                created_at: new Date().toISOString()
            });

            // 3. Approve for the demo screen
            await firestore.collection('screen_approvals').doc(`${SCREEN_ID}_${ad.id}`).set({
                screen_id: SCREEN_ID,
                ad_id: ad.id,
                status: 'approved',
                approved_by: 'system',
                approved_at: new Date().toISOString()
            });
        }

        // 4. Register Screen
        await firestore.collection('screens').doc(SCREEN_ID).set({
            screen_id: SCREEN_ID,
            status: 'active',
            location_owner_id: 'demo_owner',
            last_seen: new Date().toISOString()
        });

        res.json({ status: 'seeded', message: 'Database populated with demo data.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const usersRef = firestore.collection('users');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        const isMatch = await comparePassword(password, userData.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken({ id: userDoc.id, ...userData });

        // Return user info sans password
        const { password_hash, ...safeUser } = userData;

        res.json({
            token,
            user: safeUser
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/', (req, res) => {
    res.status(200).send('SoftoMedia Ad Server Online');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start server and bootstrap
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Bootstrap runs independently, doesn't block health checks
bootstrapAdmin().catch(console.error);
