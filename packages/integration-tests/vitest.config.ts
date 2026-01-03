import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
      ],
    },
    reporters: ['default', 'verbose'],
    outputFile: {
      json: './coverage/test-results.json',
    },
  },
  resolve: {
    alias: {
      '@lsi/protocol': path.resolve(__dirname, '../../../packages/protocol/src'),
      '@lsi/core': path.resolve(__dirname, '../../../packages/core/src'),
      '@lsi/cascade': path.resolve(__dirname, '../../../packages/cascade/src'),
      '@lsi/privacy': path.resolve(__dirname, '../../../packages/privacy/src'),
      '@lsi/superinstance': path.resolve(__dirname, '../../../packages/superinstance/src'),
      '@lsi/swarm': path.resolve(__dirname, '../../../packages/swarm/src'),
    },
  },
});
