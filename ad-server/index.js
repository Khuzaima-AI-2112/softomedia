import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8080;
const JWT_SECRET = 'demo-secret';

// --- IN-MEMORY DATABASE ---
const db = {
    users: [
        { id: 'admin_001', email: 'admin@demo.com', role: 'admin', name: 'Admin User' },
        { id: 'brand_001', email: 'brand@demo.com', role: 'brand', name: 'Demo Brand', linked_entity_id: 'demo_corp' },
        { id: 'retailer_001', email: 'retailer@demo.com', role: 'retailer', name: 'Demo Retailer', linked_entity_id: 'demo-screen-01' },
    ],
    ads: [
        { id: 'ad_001', title: 'Demo Coffee', file_path: 'demo_ad_1.png', duration: 5, status: 'approved' },
        { id: 'ad_002', title: 'Demo Tech', file_path: 'demo_ad_2.png', duration: 5, status: 'approved' },
        { id: 'ad_003', title: 'Demo Travel', file_path: 'demo_ad_3.png', duration: 5, status: 'approved' },
        { id: 'ad_004', title: 'Costco Savings', file_path: 'demo_ad_costco.png', duration: 5, status: 'approved' },
        { id: 'ad_005', title: 'Fresh Pizza', file_path: 'demo_ad_pizza.png', duration: 5, status: 'approved' },
        { id: 'ad_006', title: 'Seasonal Sale', file_path: 'seasonal_sale.png', duration: 5, status: 'approved' },
        { id: 'ad_007', title: 'Bakery Fresh', file_path: 'bakery_fresh.png', duration: 5, status: 'approved' },
    ],
    screens: [
        { screen_id: 'demo-screen-01', status: 'active', last_seen: new Date().toISOString() }
    ],
    impressions: []
};

// --- AUTH LOGIC ---
const generateToken = (user) => {
    return jwt.sign(
        { uid: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// --- ROUTES ---

app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const token = generateToken(user);
    res.json({ token, user });
});

app.get('/api/playlist/:screenId', (req, res) => {
    const loop = db.ads.map((ad, i) => ({
        slot_number: i,
        id: ad.id,
        url: `http://localhost:8080/assets/${ad.file_path}`,
        title: ad.title,
        duration: ad.duration
    }));
    // Repeat to make 12 slots if needed
    const fullLoop = [...loop, ...loop, ...loop].slice(0, 12);
    res.json({ playlist: fullLoop });
});

app.post('/api/screens/register', (req, res) => {
    const { screen_id } = req.body;
    let screen = db.screens.find(s => s.screen_id === screen_id);
    if (!screen) {
        screen = { screen_id, status: 'active', last_seen: new Date().toISOString() };
        db.screens.push(screen);
    } else {
        screen.last_seen = new Date().toISOString();
    }
    res.json({ status: 'registered', data: screen });
});

app.post('/api/screens/:screenId/impressions', (req, res) => {
    const { screenId } = req.params;
    const { ad_id } = req.body;
    db.impressions.push({ screenId, ad_id, timestamp: new Date().toISOString() });
    res.status(200).json({ status: 'ok' });
});

// Serve assets
app.use('/assets', express.static('assets'));

app.get('/api/debug/seed', (req, res) => {
    res.json({ status: 'seeded', message: 'In-memory database is ready.' });
});

app.get('/', (req, res) => res.send('SoftoMedia Ad Server (Mock) Online'));

app.listen(PORT, () => {
    console.log(`Mock Server listening on port ${PORT}`);
});
