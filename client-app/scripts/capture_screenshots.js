import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'http://localhost:5173'; // Vite default port
const SCREENSHOT_DIR = path.resolve(__dirname, '../../screenshots');
const TIMEOUT = 5000; // Time to wait for page load

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Pages to capture
const PAGES = [
    { name: '01_Player', route: '/player', persona: 'admin' }, // Player is public/agnostic usually
    { name: '02_Admin_Overview', route: '/dashboard/admin', persona: 'admin' },
    { name: '03_Admin_Screens', route: '/dashboard/admin/screens', persona: 'admin' },
    { name: '04_Admin_Playlists', route: '/dashboard/admin/playlists', persona: 'admin' },
    { name: '05_Admin_Loops', route: '/dashboard/admin/loops', persona: 'admin' },
    { name: '06_Admin_Analytics', route: '/dashboard/admin/analytics', persona: 'admin' },
    { name: '07_Brand_Dashboard', route: '/dashboard/brand', persona: 'brand' },
    { name: '08_Retailer_Dashboard', route: '/dashboard/retailer', persona: 'retailer' },
    { name: '09_Tech_Dashboard', route: '/dashboard/tech', persona: 'tech' },
    { name: '10_Health_Status', route: '/dashboard/health', persona: 'admin' }
];

async function captureScreenshots() {
    console.log('🚀 Starting screenshot capture...');
    console.log(`📂 Saving to: ${SCREENSHOT_DIR}`);

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    
    // Function to set mock auth state
    const setAuthState = async (page, role) => {
        const user = {
            id: `demo-${role}`,
            email: `${role}@demo.com`,
            role: role,
            name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`
        };
        
        await page.evaluate(({ user, role }) => {
            localStorage.setItem('auth_user', JSON.stringify(user));
            localStorage.setItem('active_persona', role);
            localStorage.setItem('auth_token', 'demo-token');
        }, { user, role });
        
        console.log(`🔑 Set auth state for: ${role}`);
    };

    try {
        for (const pageInfo of PAGES) {
            const page = await context.newPage();
            
            // Navigate to root first to set local storage context
            await page.goto(BASE_URL);
            
            // Set authentication
            await setAuthState(page, pageInfo.persona);
            
            // Navigate to actual route
            console.log(`📸 Capturing: ${pageInfo.name} (${pageInfo.route})...`);
            await page.goto(`${BASE_URL}${pageInfo.route}`, { waitUntil: 'networkidle' });
            
            // Wait a bit for animations/data to settle
            await page.waitForTimeout(2000);
            
            // Take screenshot
            await page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, `${pageInfo.name}.png`),
                fullPage: true 
            });
            
            console.log(`✅ Saved: ${pageInfo.name}.png`);
            await page.close();
        }
    } catch (error) {
        console.error('❌ Error capturing screenshots:', error);
    } finally {
        await browser.close();
        console.log('🏁 Capture complete!');
    }
}

captureScreenshots();
