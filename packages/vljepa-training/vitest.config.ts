/**
 * @fileoverview Vitest configuration for @lsi/vljepa-training
 * @package @lsi/vljepa-training
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.ts',
        '**/*.config.ts',
        'dist/',
      ],
    },
    reporters: ['default'],
  },
});
