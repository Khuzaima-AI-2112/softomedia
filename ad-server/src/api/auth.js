import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const firestore = new Firestore();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// POST /api/auth/login
// Single authoritative login handler — duplicate in index.js has been removed.
// All demo users share the password 'password' for easy persona switching during testing.
router.post('/login', async (req, res) => {
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
        const user = { id: userDoc.id, ...userDoc.data() };

        // Support both field names for backwards compatibility with any legacy docs
        const storedHash = user.password || user.password_hash;
        if (!storedHash) {
            console.error(`[Auth] User ${email} has no password hash stored.`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, storedHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { uid: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                linked_entity_id: user.linked_entity_id  // CRITICAL: Needed for brand/retailer dashboards
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
