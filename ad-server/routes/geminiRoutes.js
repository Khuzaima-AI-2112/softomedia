
import express from 'express';
import { VertexAI } from '@google-cloud/vertexai';

const router = express.Router();

// Initialize Vertex AI
// Note: This relies on GOOGLE_APPLICATION_CREDENTIALS being set or default credentials
const vertex_ai = new VertexAI({ project: 'softomedia-live-2026', location: 'us-central1' });
const model = 'gemini-1.5-flash-001';

// Instantiate the model
const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
    generationConfig: {
        'maxOutputTokens': 2048,
        'temperature': 0.4,
        'topP': 1,
    },
});

router.post('/analyze', async (req, res) => {
    try {
        const { steps } = req.body;

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ error: 'No steps provided' });
        }

        // Construct the prompt with history
        // Steps structure: { url, note, timestamp, image (base64) }
        
        const promptParts = [
            { text: "You are an expert AdTech support engineering assistant. You are analyzing a user's walkthrough of their AdManager dashboard to debug an issue. The user has provided screenshots and notes for each step of their workflow.\n\n" }
        ];

        steps.forEach((step, index) => {
            promptParts.push({ text: `\n--- STEP ${index + 1} ---\n` });
            promptParts.push({ text: `URL: ${step.url}\n` });
            promptParts.push({ text: `User Note: "${step.note}"\n` });
            
            if (step.image) {
                // Image is expected to be base64. Ensure it's clean (remove data:image/png;base64, prefix if present)
                const base64Image = step.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
                promptParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: base64Image
                    }
                });
            }
        });

        promptParts.push({ text: "\n\nBased on the sequence above, please analyze the user's issue. Explain what might be going wrong with the calculations or state based on the visual evidence and their notes. Provide actionable debugging steps." });

        const reqContent = {
            contents: [
                {
                    role: 'user',
                    parts: promptParts,
                }
            ],
        };

        const streamingResp = await generativeModel.generateContentStream(reqContent);
        const aggregatedResponse = await streamingResp.response;

        const fullText = aggregatedResponse.candidates[0].content.parts[0].text;

        res.json({ answer: fullText });

    } catch (error) {
        console.error('Error calling Gemini:', error);
        res.status(500).json({ error: 'Failed to analyze context', details: error.message });
    }
});

export default router;
