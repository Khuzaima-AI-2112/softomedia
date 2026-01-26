import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { guardrails } from '../services/ai-guardrails.js';
import fs from 'fs';
import path from 'path';

import { Storage } from '@google-cloud/storage';

const router = express.Router();
const storage = new Storage({ projectId: 'softomedia-live-2026' });
const bucketName = 'softomedia-live-2026-reports'; // We will auto-create if needed in a real app, assuming existence or permissions here.

// Helper to log errors
const logError = (err) => {
    const msg = `[${new Date().toISOString()}] ${err.stack || err}\n`;
    // Log to Artifact Directory for visibility
    const logPath = 'C:\\Users\\ChrisFro\\.gemini\\antigravity\\brain\\b58dba75-a627-46f6-9f07-c3a52398c151\\server-debug.log';
    try {
        fs.appendFileSync(logPath, msg);
    } catch (e) {
        console.error('[Ghost-AI] Failed to write to log file:', e);
    }
};

// Helper to track usage
const incrementUsage = () => {
    const statsPath = path.join(process.cwd(), 'usage_stats.json');
    const today = new Date().toISOString().split('T')[0];
    let stats = { date: today, count: 0 };

    try {
        if (fs.existsSync(statsPath)) {
            const raw = fs.readFileSync(statsPath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.date === today) {
                stats = data;
            }
        }
    } catch (e) {
        console.warn('[Ghost-AI] Failed to read stats:', e);
    }

    stats.count++;

    try {
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error('[Ghost-AI] Failed to write stats:', e);
    }

    return stats.count;
};

// Gemini 2.0 Flash pricing (per million tokens)
const PRICING = {
    inputPerMillion: 0.10,   // $0.10 per 1M input tokens
    outputPerMillion: 0.40   // $0.40 per 1M output tokens
};

// Calculate cost from token usage
const calculateCost = (inputTokens, outputTokens) => {
    const inputCost = (inputTokens / 1_000_000) * PRICING.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * PRICING.outputPerMillion;
    return parseFloat((inputCost + outputCost).toFixed(6));
};

// Initialize SDK (Lazy load logic could be here, but top level is fine for now)
// We use the Safety Harness pattern: initialization failure shouldn't crash app start
let aiModel = null;
try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
} catch (error) {
    console.error('[Ghost-AI] Failed to initialize GoogleGenerativeAI client:', error.message);
    // We don't crash, we just leave aiModel null. Routes will handle it.
}

// Apply Guardrails to ALL routes in this router
router.use(guardrails);

router.post('/analyze', async (req, res) => {
    try {
        if (!aiModel) {
            return res.status(503).json({ error: 'AI Service currently unavailable (Initialization Failed)' });
        }

        const { steps, persona, conversationId, conversationHistory, followUpText } = req.body;

        // Check if this is a follow-up or initial query
        const isFollowUp = !!(followUpText && conversationHistory?.length > 0);

        // For initial queries, require steps
        if (!isFollowUp && (!steps || !Array.isArray(steps) || steps.length === 0)) {
            return res.status(400).json({ error: 'No context steps provided' });
        }

        // Persona Logic & Security
        const ALLOWED_PERSONAS = ['CRM_buyer_persona', 'software_tester_persona'];
        const safePersona = ALLOWED_PERSONAS.includes(persona) ? persona : 'CRM_buyer_persona';

        let personality = 'You are an expert AdTech support engineering assistant.';
        try {
            const personalityPath = path.join(process.cwd(), 'config', `${safePersona}.md`);
            if (fs.existsSync(personalityPath)) {
                personality = fs.readFileSync(personalityPath, 'utf-8');
            }
        } catch (e) {
            console.warn('[Ghost-AI] Failed to load personality:', e);
        }

        // --- CONSTRUCT PROMPT ---
        const contentParts = [];

        if (isFollowUp) {
            // Follow-up mode: Include conversation history
            const promptParts = [
                personality,
                '\n--- CONVERSATION HISTORY ---',
                ...conversationHistory.map(msg =>
                    `${msg.role.toUpperCase()}: ${msg.content}`
                ),
                '\n--- NEW FOLLOW-UP QUESTION ---',
                `USER: ${followUpText}`,
                '\nPlease respond to the follow-up question, using the conversation history for context.'
            ];
            contentParts.push({ text: promptParts.join('\n') });
        } else {
            // Initial query mode with screenshots
            const promptParts = [
                personality,
                'Analyze this user walkthrough.',
                'Identify anomalies in the state, calculations, or UI logic based on the screenshots and notes.',
                'Ignore visual artifacts unrelated to data.'
            ];
            contentParts.push({ text: promptParts.join('\n') });

            // Process steps into parts (Text + Image)
            for (const [index, step] of steps.entries()) {
                contentParts.push({ text: `\n\n--- STEP ${index + 1} ---\nURL: ${step.url}\nUser Note: "${step.note || 'No note'}"\n` });

                if (step.image) {
                    // Strip header if present
                    const base64Data = step.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
                    contentParts.push({
                        inlineData: {
                            data: base64Data,
                            mimeType: 'image/png'
                        }
                    });
                }
            }

            contentParts.push({ text: '\n\n**Diagnosis & Fix**:\nPlease provide a concise markdown diagnosis.' });
        }

        // Generate
        const result = await aiModel.generateContent(contentParts);
        const response = await result.response;
        const text = response.text();

        // Extract token usage from response metadata
        const usageMetadata = response.usageMetadata || {};
        const tokenUsage = {
            input: usageMetadata.promptTokenCount || 0,
            output: usageMetadata.candidatesTokenCount || 0,
            total: usageMetadata.totalTokenCount || 0
        };
        const cost = calculateCost(tokenUsage.input, tokenUsage.output);

        // --- ARCHIVE TO GCS ---
        const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const actualConversationId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const report = {
            id: ticketId,
            conversationId: actualConversationId,
            timestamp: new Date().toISOString(),
            persona: safePersona,
            steps: isFollowUp ? [] : steps, // Only include steps for initial queries
            followUpText: isFollowUp ? followUpText : null,
            isFollowUp: isFollowUp,
            analysis: text,
            tokenUsage: tokenUsage,
            cost: cost,
            rating: null,        // To be filled by rating endpoint
            ratingFeedback: null // To be filled by rating endpoint
        };

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(`${ticketId}.json`);

        // Fire and forget upload (or await if critical)
        file.save(JSON.stringify(report), {
            contentType: 'application/json',
            metadata: {
                cacheControl: 'no-cache',
            },
        }).then(() => console.log(`[Ghost-AI] Archived ticket: ${ticketId}`))
            .catch(e => console.error(`[Ghost-AI] Archive failed: ${e.message}`));

        // Track Usage
        const dailyCount = incrementUsage();

        res.json({
            answer: text,
            ticketId: ticketId,
            conversationId: actualConversationId,
            usage: { daily: dailyCount },
            tokenUsage: tokenUsage,
            cost: cost
        });

    } catch (error) {
        console.error('[Ghost-AI] Execution Error:', error);
        logError(error);
        // Fail Open/Silent - Return generic error (but include details for debugging now)
        res.status(500).json({
            error: 'I encountered a ghost in the machine. Please try again.',
            debug: error.message
        });
    }
});

router.get('/tickets', async (req, res) => {
    try {
        const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'ticket-' });
        // Sort by time descending (filename has timestamp)
        const tickets = files
            .map(f => {
                const parts = f.name.split('-');
                return {
                    id: f.name.replace('.json', ''),
                    timestamp: new Date(parseInt(parts[1])).toISOString(),
                    url: f.metadata.mediaLink // or just ID
                };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(tickets);
    } catch (error) {
        console.error('[Ghost-AI] List Error:', error);
        res.status(500).json({ error: 'Failed to list tickets' });
    }
});

router.get('/tickets/:id', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const file = storage.bucket(bucketName).file(`${ticketId}.json`);
        const [exists] = await file.exists();

        if (!exists) return res.status(404).json({ error: 'Ticket not found' });

        const [content] = await file.download();
        const report = JSON.parse(content.toString());
        res.json(report);
    } catch (error) {
        console.error('[Ghost-AI] Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});

// --- RATING ENDPOINT ---
router.post('/tickets/:id/rate', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { rating, feedback } = req.body;

        // Validate rating
        if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
        }

        // Fetch existing ticket
        const file = storage.bucket(bucketName).file(`${ticketId}.json`);
        const [exists] = await file.exists();

        if (!exists) return res.status(404).json({ error: 'Ticket not found' });

        const [content] = await file.download();
        const report = JSON.parse(content.toString());

        // Update with rating
        report.rating = rating;
        report.ratingFeedback = feedback || null;
        report.ratedAt = new Date().toISOString();

        // Save back to GCS
        await file.save(JSON.stringify(report), {
            contentType: 'application/json',
            metadata: { cacheControl: 'no-cache' }
        });

        console.log(`[Ghost-AI] Ticket ${ticketId} rated: ${rating} stars`);
        res.json({ success: true, ticketId, rating });

    } catch (error) {
        console.error('[Ghost-AI] Rating Error:', error);
        logError(error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

// --- ADMIN ENDPOINTS (for AI Log) ---

// GET /ghost-api/admin/logs - Paginated list of all AI interactions
router.get('/admin/logs', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            startDate,
            endDate,
            minRating,
            maxRating,
            persona
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 100); // Cap at 100

        // Fetch all ticket files
        const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'ticket-' });

        // Load and filter tickets
        let logs = [];
        let totalCost = 0;
        let totalTokens = 0;

        for (const file of files) {
            try {
                const [content] = await file.download();
                const ticket = JSON.parse(content.toString());

                // Apply filters
                if (startDate && new Date(ticket.timestamp) < new Date(startDate)) continue;
                if (endDate && new Date(ticket.timestamp) > new Date(endDate)) continue;
                if (minRating && (!ticket.rating || ticket.rating < parseInt(minRating))) continue;
                if (maxRating && ticket.rating && ticket.rating > parseInt(maxRating)) continue;
                if (persona && ticket.persona !== persona) continue;

                // Accumulate totals
                totalCost += ticket.cost || 0;
                totalTokens += ticket.tokenUsage?.total || 0;

                logs.push({
                    id: ticket.id,
                    timestamp: ticket.timestamp,
                    persona: ticket.persona,
                    messageCount: ticket.steps?.length || 0,
                    rating: ticket.rating,
                    ratingFeedback: ticket.ratingFeedback,
                    cost: ticket.cost || 0,
                    tokenUsage: ticket.tokenUsage || { input: 0, output: 0, total: 0 }
                });
            } catch (e) {
                console.warn(`[Ghost-AI] Failed to parse ticket ${file.name}:`, e.message);
            }
        }

        // Sort by timestamp descending
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Paginate
        const total = logs.length;
        const totalPages = Math.ceil(total / limitNum);
        const offset = (pageNum - 1) * limitNum;
        const paginatedLogs = logs.slice(offset, offset + limitNum);

        res.json({
            logs: paginatedLogs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages
            },
            totals: {
                totalCost: parseFloat(totalCost.toFixed(4)),
                totalTokens,
                totalConversations: total
            }
        });

    } catch (error) {
        console.error('[Ghost-AI] Admin Logs Error:', error);
        logError(error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// GET /ghost-api/admin/stats - Aggregate statistics for analytics
router.get('/admin/stats', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysNum = Math.min(parseInt(days), 90); // Cap at 90 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);

        // Fetch all ticket files
        const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'ticket-' });

        // Initialize stats
        const stats = {
            totalConversations: 0,
            totalCost: 0,
            totalTokens: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            personaDistribution: {},
            dailyUsage: {},
            ratingsCount: 0
        };

        for (const file of files) {
            try {
                const [content] = await file.download();
                const ticket = JSON.parse(content.toString());

                // Skip tickets older than cutoff
                if (new Date(ticket.timestamp) < cutoffDate) continue;

                stats.totalConversations++;
                stats.totalCost += ticket.cost || 0;
                stats.totalTokens += ticket.tokenUsage?.total || 0;

                // Rating stats
                if (ticket.rating) {
                    stats.ratingDistribution[ticket.rating]++;
                    stats.ratingsCount++;
                }

                // Persona distribution
                const persona = ticket.persona || 'unknown';
                stats.personaDistribution[persona] = (stats.personaDistribution[persona] || 0) + 1;

                // Daily usage
                const day = ticket.timestamp.split('T')[0];
                if (!stats.dailyUsage[day]) {
                    stats.dailyUsage[day] = { count: 0, cost: 0 };
                }
                stats.dailyUsage[day].count++;
                stats.dailyUsage[day].cost += ticket.cost || 0;

            } catch (e) {
                console.warn(`[Ghost-AI] Failed to parse ticket for stats:`, e.message);
            }
        }

        // Calculate average rating
        if (stats.ratingsCount > 0) {
            const totalRating = Object.entries(stats.ratingDistribution)
                .reduce((sum, [rating, count]) => sum + (parseInt(rating) * count), 0);
            stats.averageRating = parseFloat((totalRating / stats.ratingsCount).toFixed(2));
        }

        // Format totals
        stats.totalCost = parseFloat(stats.totalCost.toFixed(4));

        // Convert dailyUsage to sorted array
        stats.dailyUsage = Object.entries(stats.dailyUsage)
            .map(([date, data]) => ({
                date,
                count: data.count,
                cost: parseFloat(data.cost.toFixed(4))
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.json(stats);

    } catch (error) {
        console.error('[Ghost-AI] Admin Stats Error:', error);
        logError(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
