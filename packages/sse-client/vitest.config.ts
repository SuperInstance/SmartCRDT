import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/**/*.test.ts',
        '**/*.d.ts'
      ]
    },
    setupFiles: [],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@lsi/sse-client': '/mnt/c/users/casey/smartCRDT/demo/packages/sse-client/src'
    }
  }
});
