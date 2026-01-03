import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@lsi/vljepa': resolve(__dirname, '../../../packages/vljepa/src'),
      '@lsi/a2ui': resolve(__dirname, '../../../packages/a2ui/src'),
      '@lsi/coagents': resolve(__dirname, '../../../packages/coagents/src'),
      '@lsi/protocol': resolve(__dirname, '../../../packages/protocol/src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
