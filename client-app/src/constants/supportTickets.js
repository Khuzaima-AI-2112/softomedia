/** Support Ticket vocabularies — mirror ad-server/src/services/SupportTicketService.js */
export const SUPPORT_TICKET_CATEGORIES = Object.freeze([
    { value: 'network', label: 'Network connection' },
    { value: 'hardware', label: 'Display hardware' },
    { value: 'content_sync', label: 'Content sync' },
]);

export const SUPPORT_TICKET_STATUSES = Object.freeze([
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
]);

const labelFor = (options, value) => options.find(option => option.value === value)?.label ?? value;

export const supportTicketCategoryLabel = value => labelFor(SUPPORT_TICKET_CATEGORIES, value);
export const supportTicketStatusLabel = value => labelFor(SUPPORT_TICKET_STATUSES, value);
