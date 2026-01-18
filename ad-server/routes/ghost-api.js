import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { guardrails } from '../services/ai-guardrails.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

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

// Initialize SDK (Lazy load logic could be here, but top level is fine for now)
// We use the Safety Harness pattern: initialization failure shouldn't crash app start
let aiModel = null;
try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

        const { steps } = req.body;
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ error: 'No context steps provided' });
        }

        // --- CONSTRUCT PROMPT ---
        const promptParts = [
            "You are an expert AdTech support engineering assistant. Analyze this user walkthrough.",
            "Identify anomalies in the state, calculations, or UI logic based on the screenshots and notes.",
            "Ignore visual artifacts unrelated to data."
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

        contentParts.push({ text: "\n\n**Diagnosis & Fix**:\nPlease provide a concise markdown diagnosis." });

        // Generate
        const result = await aiModel.generateContent(contentParts);
        const response = await result.response;
        const text = response.text();

        res.json({ answer: text });

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

export default router;
