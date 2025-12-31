
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// Configuration
const BUCKET_NAME = 'softomedia-live2026-ads';

const SEED_FILE = 'ad-server/seed_demo.js';
const EXPECTED_EXTENSION = '.png'; // We decided to move everything to PNG
const EXPECTED_DURATION = 5;

const storage = new Storage();

async function verify() {
    console.log('🔍 Starting Pre-deployment Verification...');
    let errors = 0;

    // 1. Verify SEED script content
    console.log(`\nChecking Config in ${SEED_FILE}...`);
    const seedContent = fs.readFileSync(SEED_FILE, 'utf8');

    // Check for SVGs (Failure condition)
    if (seedContent.includes('.svg')) {
        console.error('❌ FAIL: Seed file contains .svg references. All ads must be .png.');
        errors++;
    } else {
        console.log('✅ PASS: No .svg references found.');
    }

    // Check for correct duration
    // Simple regex check for "duration: 5"
    if (seedContent.includes('duration: 5')) {
        console.log('✅ PASS: Found "duration: 5" configuration.');
    } else {
        console.error(`❌ FAIL: "duration: ${EXPECTED_DURATION}" not found in seed script. Check durations.`);
        errors++;
    }

    // 1.5 Verify ad-server/index.js for hardcoded legacy data
    const INDEX_FILE = 'ad-server/index.js';
    console.log(`\nChecking source code in ${INDEX_FILE}...`);
    try {
        const indexContent = fs.readFileSync(INDEX_FILE, 'utf8');
        if (indexContent.includes('.svg')) {
            console.error('❌ FAIL: index.js contains hardcoded .svg references. Use seed data only!');
            errors++;
        } else {
            console.log('✅ PASS: No hardcoded .svg in index.js.');
        }
    } catch (e) {
        console.warn('⚠️ WARN: Could not check index.js (file missing?)');
    }

    // 2. Verify Cloud Storage Assets
    console.log(`\nChecking Assets in gs://${BUCKET_NAME}...`);
    try {
        const [files] = await storage.bucket(BUCKET_NAME).getFiles();
        const fileNames = files.map(f => f.name);

        const requiredAssets = [
            'demo_ad_costco.png',
            'demo_ad_pizza.png',
            'demo_ad_1.png',
            'demo_ad_2.png',
            'demo_ad_3.png'
        ];

        requiredAssets.forEach(asset => {
            if (fileNames.includes(asset)) {
                console.log(`✅ PASS: Found ${asset}`);
            } else {
                console.error(`❌ FAIL: Missing required asset: ${asset}`);
                errors++;
            }
        });

    } catch (e) {
        console.error('❌ FAIL: Could not list GCS bucket. Check permissions.', e.message);
        errors++;
    }

    // Summary
    console.log('\n-----------------------------------');
    if (errors === 0) {
        console.log('✅ VERIFICATION SUCCEEDED. Safe to deploy.');
        process.exit(0);
    } else {
        console.error(`❌ VERIFICATION FAILED with ${errors} errors.`);
        console.error('Fix these errors before deploying.');
        process.exit(1);
    }
}

verify().catch(e => {
    console.error('Script Error:', e);
    process.exit(1);
});
