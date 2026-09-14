import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('8080'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    ALLOW_DEMO_MODE: z.preprocess(val => val === 'true', z.boolean()).default(false)
});

export function validateEnv() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('❌ Invalid environment configuration:', parsed.error.format());
        process.exit(1);
    }

    return parsed.data;
}

// We don't export the parsed data statically to avoid ESM hoisting issues
// where validateEnv might run before dotenv.config() in index.js
