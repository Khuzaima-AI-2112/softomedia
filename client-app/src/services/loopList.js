// GET /api/loops answers { loops, business_hours }; callers that only need the
// loops read them through here instead of assuming a bare array (#26).
export function loopListFrom(response) {
    if (Array.isArray(response)) return response;
    return Array.isArray(response?.loops) ? response.loops : [];
}
