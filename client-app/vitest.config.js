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
            exclude: ['node_modules', 'dist', 'src/pages/**', 'src/layouts/**', 'src/contexts/**'],
            thresholds: {
                lines: 15,
                functions: 15,
                branches: 15,
                statements: 15
            }
        }
    }
});
