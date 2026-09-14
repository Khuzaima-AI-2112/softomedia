// Support Ticket API Service
// Authenticated, persisted Support Tickets (Retailer-reported operational issues).

import apiClient from './api.js';

export const supportTicketAPI = {
    /** Support Tickets visible to the signed-in user. */
    async list() {
        return apiClient.get('/api/tickets');
    },

    async get(ticketId) {
        return apiClient.get(`/api/tickets/${encodeURIComponent(ticketId)}`);
    },

    /**
     * Report an issue for the signed-in Retailer Administrator's organization.
     * @param {{subject: string, category: string, description: string}} ticket
     */
    async create(ticket) {
        return apiClient.post('/api/tickets', ticket);
    },

    /**
     * Change status and/or add a note (Technical Operator and Super Administrator).
     * @param {string} ticketId
     * @param {{status?: string, note?: string}} update
     */
    async update(ticketId, update) {
        return apiClient.patch(`/api/tickets/${encodeURIComponent(ticketId)}`, update);
    },
};
