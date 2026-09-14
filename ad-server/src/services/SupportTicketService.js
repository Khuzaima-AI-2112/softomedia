import { v4 as uuidv4 } from 'uuid';
import { supportTicketRepository } from '../repositories/SupportTicketRepository.js';
import { PERMISSIONS, userHasPermission } from '../middleware/requireRole.js';

export const SUPPORT_TICKET_CATEGORIES = Object.freeze(['network', 'hardware', 'content_sync']);
export const SUPPORT_TICKET_STATUSES = Object.freeze(['open', 'in_progress', 'resolved']);

export class SupportTicketError extends Error {
    constructor(message, status, details = {}) {
        super(message);
        this.name = 'SupportTicketError';
        this.status = status;
        this.details = details;
    }
}

const accessDenied = () => new SupportTicketError('Access denied', 403);
const notFound = () => new SupportTicketError('Support Ticket not found', 404);

const isText = (value, maxLength) => typeof value === 'string'
    && value.trim().length > 0
    && value.trim().length <= maxLength;

function validateNewTicket(body) {
    const fields = [
        !isText(body.subject, 120) && 'subject',
        !SUPPORT_TICKET_CATEGORIES.includes(body.category) && 'category',
        !isText(body.description, 2000) && 'description',
    ].filter(Boolean);
    if (fields.length > 0) throw new SupportTicketError('Invalid Support Ticket', 400, { fields });
}

function validateUpdate(body) {
    const hasStatus = body.status !== undefined;
    const hasNote = body.note !== undefined && body.note !== '';
    const fields = !hasStatus && !hasNote
        ? ['status', 'note']
        : [
            hasStatus && !SUPPORT_TICKET_STATUSES.includes(body.status) && 'status',
            hasNote && !isText(body.note, 2000) && 'note',
        ].filter(Boolean);
    if (fields.length > 0) throw new SupportTicketError('Invalid Support Ticket update', 400, { fields });
}

function newestFirst(tickets) {
    return [...tickets].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

const managesNetwork = user => userHasPermission(user, PERMISSIONS.SUPPORT_TICKET_MANAGE_NETWORK);

function ownRetailerId(user, permission) {
    return userHasPermission(user, permission) ? user.organization_id || null : null;
}

export class SupportTicketService {
    async create(user, body) {
        const retailerId = ownRetailerId(user, PERMISSIONS.SUPPORT_TICKET_CREATE_OWN);
        if (!retailerId) throw accessDenied();
        validateNewTicket(body);

        return supportTicketRepository.create(uuidv4(), {
            retailer_id: retailerId,
            subject: body.subject.trim(),
            category: body.category,
            description: body.description.trim(),
            status: 'open',
            notes: [],
            created_by: user.id,
        });
    }

    async list(user) {
        if (managesNetwork(user)) {
            return newestFirst(await supportTicketRepository.findAll());
        }
        const retailerId = ownRetailerId(user, PERMISSIONS.SUPPORT_TICKET_VIEW_OWN);
        if (!retailerId) throw accessDenied();
        return newestFirst(await supportTicketRepository.findByRetailer(retailerId));
    }

    async get(user, ticketId) {
        const ticket = await supportTicketRepository.findById(ticketId);
        if (managesNetwork(user)) {
            if (!ticket) throw notFound();
            return ticket;
        }
        const retailerId = ownRetailerId(user, PERMISSIONS.SUPPORT_TICKET_VIEW_OWN);
        if (!retailerId || ticket?.retailer_id !== retailerId) throw accessDenied();
        return ticket;
    }

    async update(user, ticketId, body) {
        if (!managesNetwork(user)) throw accessDenied();
        validateUpdate(body);

        const note = body.note ? {
            id: uuidv4(),
            body: body.note.trim(),
            author_id: user.id,
            author_role: user.role,
            created_at: new Date().toISOString(),
        } : null;
        const updated = await supportTicketRepository.applyChange(ticketId, ticket => ({
            ...ticket,
            ...(body.status ? { status: body.status } : {}),
            notes: note ? [...(ticket.notes || []), note] : ticket.notes || [],
        }));
        if (!updated) throw notFound();
        return updated;
    }
}

export const supportTicketService = new SupportTicketService();
