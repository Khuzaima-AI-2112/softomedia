
import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not set');
        process.exit(1);
    }

    // Model failing in production
    const modelName = 'gemini-pro';
    console.log(`Testing key with model: ${modelName}`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Hello');
        const response = await result.response;

        console.log('✅ SUCCESS! Response:', response.text());
    } catch (error) {
        console.error('❌ FAILED!');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

test();
