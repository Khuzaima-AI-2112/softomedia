import { provisionDemoPersonas } from '../src/services/DemoPersonaProvisioner.js';

try {
    const personas = await provisionDemoPersonas({
        password: process.env.DEMO_ACCOUNT_PASSWORD,
        expectedProjectId: process.env.DEMO_PROJECT_ID,
    });
    console.log(`Provisioned ${personas.length} Firebase demo personas in ${process.env.DEMO_PROJECT_ID}.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
