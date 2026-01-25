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

// Initialize SDK (Lazy load logic could be here, but top level is fine for now)
// We use the Safety Harness pattern: initialization failure shouldn't crash app start
let aiModel = null;
try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

        const { steps, persona } = req.body;
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
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
        const promptParts = [
            personality,
            'Analyze this user walkthrough.',
            'Identify anomalies in the state, calculations, or UI logic based on the screenshots and notes.',
            'Ignore visual artifacts unrelated to data.'
        ];

        // Process steps into parts (Text + Image)
        // Note: SDK expects [{ text: ... }, { inlineData: ... }]
        const contentParts = [
            { text: promptParts.join('\n') }
        ];

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

        // Generate
        const result = await aiModel.generateContent(contentParts);
        const response = await result.response;
        const text = response.text();

        // --- ARCHIVE TO GCS ---
        const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const report = {
            id: ticketId,
            timestamp: new Date().toISOString(),
            persona: safePersona,
            steps: steps, // Contains URL, notes, images, timestamps
            analysis: text
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

        res.json({ answer: text, ticketId: ticketId, usage: { daily: dailyCount } });

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

export default router;
