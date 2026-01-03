import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'tests/**/*.ts'],
    exclude: ['node_modules', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'build/', '*.test.ts'],
    },
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.mjs'],
    alias: {
      '@': '/packages',
    },
  },
});
