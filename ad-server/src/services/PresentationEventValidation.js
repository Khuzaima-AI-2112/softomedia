export class PresentationEventError extends Error {
    constructor(message, status = 422, details = {}) {
        super(message);
        this.name = 'PresentationEventError';
        this.status = status;
        this.details = details;
    }
}

export function validatePresentationMetadata(body) {
    const presentationStartedAt = new Date(body.presentation_started_at);
    if (Number.isNaN(presentationStartedAt.getTime())) {
        throw new PresentationEventError('presentation_started_at must be an ISO 8601 timestamp', 400);
    }
    if (presentationStartedAt.getTime() > Date.now() + 5_000) {
        throw new PresentationEventError('presentation_started_at cannot be in the future', 422);
    }
    if (typeof body.intended_duration_seconds !== 'number' || body.intended_duration_seconds <= 0) {
        throw new PresentationEventError('intended_duration_seconds must be greater than zero', 400);
    }
    return presentationStartedAt;
}
