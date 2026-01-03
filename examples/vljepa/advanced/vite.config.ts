import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@vljepa/core': resolve(__dirname, '../../../packages/vljepa/src'),
      '@vljepa/vision': resolve(__dirname, '../../../packages/vljepa/src'),
      '@vljepa/ui': resolve(__dirname, '../../../packages/vljepa/src'),
      '@vljepa/oracle': resolve(__dirname, '../../../packages/vljepa/src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/']
    }
  }
});
