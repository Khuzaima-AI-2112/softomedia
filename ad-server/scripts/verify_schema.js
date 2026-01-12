import { PricingConfigSchema } from '../src/schemas/PricingSchema.js';
import { Firestore } from '@google-cloud/firestore';
import fs from 'fs';
import path from 'path';

/**
 * Verify Pricing Schema
 * Usage: node scripts/verify_schema.js [--local | --cloud]
 */
async function verifySchema() {
    const args = process.argv.slice(2);
    const isCloud = args.includes('--cloud');
    const projectId = 'softomedia-live-2026';

    console.log(`[SCHEMA_VERIFY] Mode: ${isCloud ? 'Cloud' : 'Local'}`);

    try {
        let configData;

        if (isCloud) {
            const db = new Firestore({ projectId });
            const doc = await db.collection('pricing_config').doc('global').get();
            if (!doc.exists) {
                console.error('❌ Cloud document pricing_config/global not found');
                process.exit(1);
            }
            configData = doc.data();
        } else {
            const db = new Firestore({ projectId });
            const doc = await db.collection('pricing_config').doc('global').get();
            configData = doc.data();
        }

        if (!configData) {
            console.error('❌ No pricing configuration data found to verify');
            process.exit(1);
        }

        // Normalize data (handle legacy snake_case for validation check)
        const normalized = { ...configData };

        const map = {
            'base_cpm': 'baseCPM',
            'traffic_tiers': 'trafficTiers',
            'date_overrides': 'dateOverrides',
            'retailer_overrides': 'retailerOverrides',
            'updated_at': 'updatedAt'
        };

        Object.entries(map).forEach(([snake, camel]) => {
            if (configData[snake] !== undefined) {
                normalized[camel] = configData[snake];
            }
        });

        // Deep normalization for dateOverrides (handle legacy number values)
        if (normalized.dateOverrides) {
            const normalizedDates = {};
            Object.entries(normalized.dateOverrides).forEach(([date, value]) => {
                normalizedDates[date] = typeof value === 'number' ? { multiplier: value } : value;
            });
            normalized.dateOverrides = normalizedDates;
        }

        console.log('[SCHEMA_VERIFY] Validating data structure...');
        const result = PricingConfigSchema.safeParse(normalized);

        if (result.success) {
            console.log('✅ SCHEMA VALID: Pricing configuration is logically healthy');

            // Check if it's legacy
            const isLegacy = configData.base_cpm !== undefined || configData.traffic_tiers !== undefined;
            if (isLegacy) {
                console.warn('⚠️ WARNING: Configuration is in LEGACY format (snake_case). Run /parity for details.');
            }
            process.exit(0);
        } else {
            console.error('❌ SCHEMA INVALID: Errors found:');
            // Zod error formatting can be very verbose, let's simplify for the SRE report
            result.error.issues.forEach(issue => {
                console.error(` - [${issue.path.join('.')}] ${issue.message}`);
            });
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    }
}

verifySchema();
