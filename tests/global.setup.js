import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config) {
    const { baseURL } = config.projects[0].use;
    const browser = await chromium.launch();

    // Create state directory if it doesn't exist
    if (!fs.existsSync('tests/.auth')) {
        fs.mkdirSync('tests/.auth');
    }

    const personas = ['brand', 'admin', 'retailer'];

    for (const persona of personas) {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Navigate to base URL
        await page.goto(baseURL);

        // Inject persona into localStorage
        await page.evaluate((p) => {
            localStorage.setItem('active_persona', p);
        }, persona);

        // Save storage state
        await page.context().storageState({ path: `tests/.auth/${persona}.json` });
        await context.close();
    }

    await browser.close();
}

export default globalSetup;
