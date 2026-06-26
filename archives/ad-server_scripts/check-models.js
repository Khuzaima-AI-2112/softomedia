
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.development') });

import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
    console.log('🔍 Testing Gemini 2.0 Flash Stable...');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ FATAL ERROR: GEMINI_API_KEY environment variable is not set.');
        process.exit(1);
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent('Hello');
        console.log('✅ gemini-2.0-flash IS working. Response:', result.response.text());
    } catch (e) {
        console.error('❌ gemini-2.0-flash failed:', e.message);

        try {
            console.log('🔍 Testing Gemini 1.5 Flash...');
            const model15 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result15 = await model15.generateContent('Hello');
            console.log('✅ gemini-1.5-flash IS working. Response:', result15.response.text());
        } catch (e2) {
            console.error('❌ gemini-1.5-flash failed:', e2.message);
        }
    }
}

listModels();
