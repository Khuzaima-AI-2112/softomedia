import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'index.js',
      name: 'ad-server',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['@google-cloud/firestore', '@google-cloud/storage', 'express', 'cors', 'jsonwebtoken', 'bcryptjs', 'multer']
    }
  }
});
