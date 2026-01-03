import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: false,
    threads: false,
    alias: {
      '@lsi/protocol': resolve(__dirname, '../protocol/src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/types.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@lsi/protocol': resolve(__dirname, '../protocol/src'),
      // Resolve relative imports to source files instead of dist
      './refiner/SemanticCache': resolve(__dirname, './src/refiner/SemanticCache'),
      './cache/CacheInvalidator': resolve(__dirname, './src/cache/CacheInvalidator'),
      './cache/CacheInvalidator.js': resolve(__dirname, './src/cache/CacheInvalidator'),
      './refiner/SemanticCache.js': resolve(__dirname, './src/refiner/SemanticCache'),
    },
    // This is critical - don't use package.json exports field for tests
    conditions: ['source'],
    exportsFields: [],
  },
  esbuild: {
    target: 'esnext'
  }
});
