/**
 * Vitest Benchmark Configuration
 *
 * Extends base vitest config with benchmark-specific settings.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Benchmark mode
    benchmark: {
      // Include files matching this pattern
      include: ['**/*.bench.ts'],

      // Exclude test files
      exclude: ['**/*.test.ts', '**/node_modules/**'],

      // Number of iterations for measurement
      iterations: 100,

      // Warmup iterations
      warmupIterations: 5,

      // Warmup time in milliseconds
      warmupTime: 100,

      // Time in milliseconds
      time: 1000,

      // Output format
      reporter: ['default', 'json'],

      // Output file for JSON results
      outputFile: './benchmark-results.json'
    },

    // General test settings
    include: ['**/*.bench.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 60000,
    hookTimeout: 60000,

    // Coverage (not needed for benchmarks)
    coverage: {
      enabled: false
    },

    // Type checking
    typecheck: {
      enabled: false
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@lsi/protocol': '../../../protocol/src/index.ts',
      '@lsi/cascade': '../../../cascade/src/index.ts',
      '@lsi/swarm': '../../../swarm/src/index.ts',
      '@lsi/privacy': '../../../privacy/src/index.ts',
      '@lsi/superinstance': '../../../superinstance/src/index.ts'
    }
  }
});
