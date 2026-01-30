// Test script for Gemini 2.0 API key
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini20() {
    console.log('🧪 Testing Gemini 2.0 API key...\n');

    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAYgmZKRaGIiLjtNWCNmA2sTR2gPIxMV5o';

    console.log(`✓ API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`✓ Key length: ${apiKey.length} characters\n`);

    try {
        console.log('1️⃣ Initializing GoogleGenerativeAI...');
        const genAI = new GoogleGenerativeAI(apiKey);
        console.log('   ✓ Initialized\n');

        console.log('2️⃣ Getting Gemini 1.5 model (gemini-1.5-flash)...');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('   ✓ Model retrieved\n');

        console.log('3️⃣ Generating test content...');
        const result = await model.generateContent('Say "Hello from Gemini 2.0!" in a friendly way.');
        const response = await result.response;
        const text = response.text();

        console.log('   ✓ Generation successful!\n');
        console.log('📝 Response from Gemini 2.0:');
        console.log('   ' + text.replace(/\n/g, '\n   '));
        console.log('\n✅ SUCCESS! Gemini 2.0 API is working correctly.\n');

        return true;
    } catch (error) {
        console.error('\n❌ FAILED!');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);

        if (error.message.includes('API key not valid')) {
            console.error('\n💡 The API key is invalid or not authorized for Gemini 2.0');
            console.error('   Check: https://aistudio.google.com/app/apikey');
        } else if (error.message.includes('quota')) {
            console.error('\n💡 Quota exceeded or billing not enabled');
            console.error('   Check: https://console.cloud.google.com/billing');
        } else if (error.message.includes('model not found')) {
            console.error('\n💡 Model "gemini-2.0-flash-exp" not accessible with this key');
            console.error('   Try: gemini-2.0-flash-thinking-exp or gemini-1.5-pro');
        }

        console.error('\nFull error:', error);
        process.exit(1);
    }
}

testGemini20();
