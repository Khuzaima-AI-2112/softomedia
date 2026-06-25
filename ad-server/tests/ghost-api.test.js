import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// === MOCK FUNCTION REFERENCES (for per-test control) ===
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();
const mockBucketFile = jest.fn();
const mockBucketGetFiles = jest.fn();
const mockFileSave = jest.fn();
const mockFileExists = jest.fn();
const mockFileDownload = jest.fn();

// === ESM MOCKING: jest.unstable_mockModule() MUST come BEFORE any module imports ===

// 1. Mock @google/generative-ai
jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel.mockReturnValue({
            generateContent: mockGenerateContent
        })
    }))
}));

// 2. Mock @google-cloud/storage
jest.unstable_mockModule('@google-cloud/storage', () => ({
    Storage: jest.fn().mockImplementation(() => ({
        bucket: jest.fn().mockReturnValue({
            file: mockBucketFile.mockReturnValue({
                save: mockFileSave,
                exists: mockFileExists,
                download: mockFileDownload
            }),
            getFiles: mockBucketGetFiles
        })
    }))
}));

// 3. Mock ai-guardrails (passthrough middleware)
jest.unstable_mockModule('../services/ai-guardrails.js', () => ({
    guardrails: (req, res, next) => next()
}));

// 4. Mock fs module for file operations (prevents actual file writes during tests)
// Node.js built-in modules need both named exports and default export
const mockFs = {
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue(JSON.stringify({ date: '2026-01-30', count: 5 })),
    writeFileSync: jest.fn(),
    appendFileSync: jest.fn(),
    mkdirSync: jest.fn()
};
jest.unstable_mockModule('fs', () => ({
    ...mockFs,
    default: mockFs
}));

// === DYNAMIC IMPORTS (AFTER all mocks are registered) ===
const { default: ghostRouter } = await import('../routes/ghost-api.js');

describe('Ghost AI API', () => {
    let app;

    beforeEach(async () => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Set required env vars
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.ALLOW_DEMO_MODE = 'true';

        // Default success behavior for mocks
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => 'Mocked AI Response',
                usageMetadata: {
                    promptTokenCount: 100,
                    candidatesTokenCount: 50,
                    totalTokenCount: 150
                }
            }
        });

        mockFileSave.mockResolvedValue(true);
        mockFileExists.mockResolvedValue([true]);
        mockFileDownload.mockResolvedValue([JSON.stringify({
            id: 'ticket-123',
            analysis: 'Mock Analysis',
            rating: null
        })]);
        mockBucketGetFiles.mockResolvedValue([[]]);

        // Create fresh Express app for each test
        const { createTestApp } = await import('./fixtures/test-app.js');
        app = createTestApp(ghostRouter, '/ghost-api');
    });

    describe('POST /analyze', () => {
        test('returns 400 when steps are missing', async () => {
            const response = await request(app)
                .post('/ghost-api/analyze')
                .send({ persona: 'CRM_buyer_persona' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('No context steps provided');
        });

        test('returns 200 with valid input', async () => {
            const response = await request(app)
                .post('/ghost-api/analyze')
                .send({
                    persona: 'CRM_buyer_persona',
                    steps: [{ url: '/test', note: 'Test note' }]
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('answer', 'Mocked AI Response');
            expect(response.body).toHaveProperty('ticketId');
            expect(response.body).toHaveProperty('conversationId');
            expect(response.body).toHaveProperty('tokenUsage');
            expect(response.body.tokenUsage.input).toBe(100);
            expect(response.body.tokenUsage.output).toBe(50);
        });

        test('returns 500 when generateContent throws an error', async () => {
            // Override mock to throw error
            mockGenerateContent.mockRejectedValue(new Error('API Key Invalid'));

            const response = await request(app)
                .post('/ghost-api/analyze')
                .send({
                    persona: 'CRM_buyer_persona',
                    steps: [{ url: '/test', note: 'Test note' }]
                });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('ghost in the machine');
        });

        test('handles follow-up conversations without requiring steps', async () => {
            const response = await request(app)
                .post('/ghost-api/analyze')
                .send({
                    persona: 'CRM_buyer_persona',
                    followUpText: 'Can you clarify that?',
                    conversationHistory: [
                        { role: 'user', content: 'Initial question' },
                        { role: 'assistant', content: 'Initial response' }
                    ],
                    conversationId: 'conv-existing-123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('answer');
            expect(response.body.conversationId).toBe('conv-existing-123');
        });

        test('uses default persona when invalid persona provided', async () => {
            const response = await request(app)
                .post('/ghost-api/analyze')
                .send({
                    persona: 'malicious_persona',
                    steps: [{ url: '/test' }]
                });

            expect(response.status).toBe(200);
            // Should still succeed with default persona
            expect(response.body).toHaveProperty('answer');
        });
    });

    describe('GET /tickets', () => {
        test('returns list of tickets', async () => {
            mockBucketGetFiles.mockResolvedValue([[
                {
                    name: 'ticket-1706600000000-abc123.json',
                    metadata: { mediaLink: 'https://storage.example.com/ticket.json' }
                }
            ]]);

            const response = await request(app).get('/ghost-api/tickets');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('returns 500 when storage fails', async () => {
            mockBucketGetFiles.mockRejectedValue(new Error('Storage unavailable'));

            const response = await request(app).get('/ghost-api/tickets');

            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Failed to list tickets');
        });
    });

    describe('GET /tickets/:id', () => {
        test('returns ticket by id', async () => {
            const ticketData = {
                id: 'ticket-123',
                analysis: 'Test analysis',
                rating: 4
            };
            mockFileDownload.mockResolvedValue([JSON.stringify(ticketData)]);

            const response = await request(app).get('/ghost-api/tickets/ticket-123');

            expect(response.status).toBe(200);
            expect(response.body.id).toBe('ticket-123');
            expect(response.body.analysis).toBe('Test analysis');
        });

        test('returns 404 when ticket not found', async () => {
            mockFileExists.mockResolvedValue([false]);

            const response = await request(app).get('/ghost-api/tickets/nonexistent');

            expect(response.status).toBe(404);
            expect(response.body.error).toContain('Ticket not found');
        });
    });

    describe('POST /tickets/:id/rate', () => {
        test('saves rating successfully', async () => {
            mockFileSave.mockResolvedValue(true);

            const response = await request(app)
                .post('/ghost-api/tickets/ticket-123/rate')
                .send({ rating: 5, feedback: 'Great response!' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.rating).toBe(5);
        });

        test('returns 400 for invalid rating', async () => {
            const response = await request(app)
                .post('/ghost-api/tickets/ticket-123/rate')
                .send({ rating: 6 }); // Invalid: must be 1-5

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Rating must be');
        });

        test('returns 404 when ticket not found', async () => {
            mockFileExists.mockResolvedValue([false]);

            const response = await request(app)
                .post('/ghost-api/tickets/nonexistent/rate')
                .send({ rating: 4 });

            expect(response.status).toBe(404);
        });
    });
});
