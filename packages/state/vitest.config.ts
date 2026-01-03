import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'eventemitter3': 'eventemitter3'
    }
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['test/**/*.ts', 'node_modules/', 'dist/']
    }
  }
});
