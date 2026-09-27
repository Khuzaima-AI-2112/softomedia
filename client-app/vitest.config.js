import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{js,jsx}'],
            exclude: ['src/**/*.test.{js,jsx}'],
            // Ratchet: just under the measured baseline (#29); raised to 90% lines by #48.
            thresholds: {
                lines: 25,
                functions: 33,
                branches: 60,
                statements: 25
            }
        }
    }
});
