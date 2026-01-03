import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@lsi/protocol': '/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src',
    },
  },
});
