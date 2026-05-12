import express from 'express';

const router = express.Router();

// Helper: get Firestore db from app locals (set in server bootstrap)
const getDb = (req) => req.app.locals.db || null;

// ─── Utility ────────────────────────────────────────────────────────────────

const COLLECTION = 'support_tickets';

const ticketFromDoc = (doc) => ({ id: doc.id, ...doc.data() });

/**
 * GET /api/tickets
 * List tickets with optional status/priority filters + pagination.
 * Query params: status, priority, page (default 1), limit (default 15)
 */
router.get('/', async (req, res) => {
    try {
        const db = getDb(req);
        const { status, priority, page = 1, limit = 15 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

        if (!db) {
            // Mock fallback when Firestore is not connected
            return res.json({ tickets: [], totalPages: 1, page: pageNum });
        }

        let query = db.collection(COLLECTION).orderBy('createdAt', 'desc');
        if (status && status !== 'all') query = query.where('status', '==', status);
        if (priority && priority !== 'all') query = query.where('priority', '==', priority);

        const snapshot = await query.get();
        const all = snapshot.docs.map(ticketFromDoc);
        const totalPages = Math.max(1, Math.ceil(all.length / limitNum));
        const tickets = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({ tickets, totalPages, page: pageNum, total: all.length });
    } catch (error) {
        console.error('[tickets] GET / error:', error);
        res.status(500).json({ error: 'Failed to fetch tickets.' });
    }
});

/**
 * GET /api/tickets/:id
 * Single ticket with full timeline.
 */
router.get('/:id', async (req, res) => {
    try {
        const db = getDb(req);
        const { id } = req.params;

        if (!db) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }

        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: `Ticket ${id} not found.` });
        }

        res.json(ticketFromDoc(doc));
    } catch (error) {
        console.error('[tickets] GET /:id error:', error);
        res.status(500).json({ error: 'Failed to fetch ticket.' });
    }
});

/**
 * POST /api/tickets
 * Create a new ticket (from screen alert or manual creation).
 * Body: { screenId, priority, description, createdBy }
 */
router.post('/', async (req, res) => {
    try {
        const db = getDb(req);
        const { screenId, priority = 'medium', description = '', createdBy = 'system' } = req.body;

        if (!screenId) {
            return res.status(400).json({ error: 'screenId is required.' });
        }

        const now = new Date().toISOString();
        const ticket = {
            screenId,
            priority,
            description,
            createdBy,
            status: 'open',
            resolutionNotes: '',
            createdAt: now,
            updatedAt: now,
            timeline: [
                { status: 'open', at: now, by: createdBy, note: 'Ticket created.' },
            ],
        };

        if (!db) {
            // Return a mock response when Firestore is unavailable
            return res.status(201).json({ id: `mock-${Date.now()}`, ...ticket });
        }

        const ref = await db.collection(COLLECTION).add(ticket);
        res.status(201).json({ id: ref.id, ...ticket });
    } catch (error) {
        console.error('[tickets] POST / error:', error);
        res.status(500).json({ error: 'Failed to create ticket.' });
    }
});

/**
 * PUT /api/tickets/:id
 * Update status and/or resolution notes.
 * Body: { status, resolutionNotes }
 */
router.put('/:id', async (req, res) => {
    try {
        const db = getDb(req);
        const { id } = req.params;
        const { status, resolutionNotes, updatedBy = 'tech' } = req.body;

        if (!db) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }

        const ref = db.collection(COLLECTION).doc(id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ error: `Ticket ${id} not found.` });
        }

        const existing = doc.data();
        const now = new Date().toISOString();
        const updates = { updatedAt: now };

        if (status && status !== existing.status) {
            updates.status = status;
            updates.timeline = [
                ...(existing.timeline || []),
                { status, at: now, by: updatedBy, note: resolutionNotes || '' },
            ];
        }

        if (resolutionNotes !== undefined) {
            updates.resolutionNotes = resolutionNotes;
        }

        await ref.update(updates);
        const updated = await ref.get();
        res.json(ticketFromDoc(updated));
    } catch (error) {
        console.error('[tickets] PUT /:id error:', error);
        res.status(500).json({ error: 'Failed to update ticket.' });
    }
});

export default router;
