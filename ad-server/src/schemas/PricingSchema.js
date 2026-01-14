import { z } from 'zod';

/**
 * Traffic Tier Schema
 */
const TrafficTierSchema = z.object({
    multiplier: z.number().min(0.1).max(5.0),
    label: z.string().min(1),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    hours: z.array(z.number().int().min(0).max(23))
});

/**
 * Pricing Config Local Schema
 */
export const PricingConfigSchema = z.object({
    id: z.string().optional(),
    schemaVersion: z.number().int().min(1).default(1),
    baseCPM: z.number().positive().min(0.01).max(1000),
    currency: z.string().default('USD'),
    slotDuration: z.number().int().positive().default(5),
    slotsPerLoop: z.number().int().positive().default(12),
    trafficTiers: z.record(z.string(), TrafficTierSchema),
    dateOverrides: z.record(z.string(), z.object({
        multiplier: z.number().min(0.1).max(5.0),
        label: z.string().optional(),
        hourlyTiers: z.record(z.string(), z.string()).optional()
    })).optional().default({}),
    retailerOverrides: z.record(z.string(), z.object({
        baseCPM: z.number().positive().optional()
    })).optional().default({}),
    updatedAt: z.string().optional()
});

export default PricingConfigSchema;
