
import { VertexAI } from '@google-cloud/vertexai';

async function testVertex() {
    console.log('🧪 Testing Vertex AI connection...');

    try {
        const vertex_ai = new VertexAI({ project: 'softomedia-live-2026', location: 'us-central1' });
        const model = 'gemini-1.5-flash-001';

        console.log('✓ Initialized VertexAI for project softomedia-live-2026');

        const generativeModel = vertex_ai.preview.getGenerativeModel({
            model: model,
            generationConfig: {
                'maxOutputTokens': 2048,
                'temperature': 0.4,
                'topP': 1,
            },
        });

        console.log('🚀 Generating content...');
        const req = {
            contents: [{ role: 'user', parts: [{ text: 'Hello, are you working?' }] }],
        };

        const streamingResp = await generativeModel.generateContentStream(req);
        const aggregatedResponse = await streamingResp.response;
        const fullText = aggregatedResponse.candidates[0].content.parts[0].text;

        console.log('✅ Success! Response:', fullText);
    } catch (error) {
        console.error('❌ Failed:', error);
    }
}

testVertex();
