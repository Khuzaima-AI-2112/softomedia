import express from 'express';
import logger from '../utils/logger.js';
import { supportTicketService, SupportTicketError } from '../services/SupportTicketService.js';

const router = express.Router();

function respondWithError(res, error, action) {
    if (error instanceof SupportTicketError) {
        return res.status(error.status).json({ error: error.message, ...error.details });
    }
    logger.error(`Support Ticket ${action} failed`, { error: error.message });
    return res.status(503).json({ error: `Support Ticket could not be ${action}` });
}

// GET /api/tickets — Support Tickets visible to the authenticated user
router.get('/', async (req, res) => {
    try {
        return res.json(await supportTicketService.list(req.user));
    } catch (error) {
        return respondWithError(res, error, 'loaded');
    }
});

// POST /api/tickets — a Retailer Administrator reports an issue for its organization
router.post('/', async (req, res) => {
    try {
        return res.status(201).json(await supportTicketService.create(req.user, req.body || {}));
    } catch (error) {
        return respondWithError(res, error, 'saved');
    }
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
    try {
        return res.json(await supportTicketService.get(req.user, req.params.id));
    } catch (error) {
        return respondWithError(res, error, 'loaded');
    }
});

// PATCH /api/tickets/:id — a network ticket manager changes status and/or adds a note
router.patch('/:id', async (req, res) => {
    try {
        return res.json(await supportTicketService.update(req.user, req.params.id, req.body || {}));
    } catch (error) {
        return respondWithError(res, error, 'updated');
    }
});

export default router;
