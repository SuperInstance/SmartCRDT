/**
 * Test setup for progressive-render package
 */

import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Mock performance API for tests
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now())
  } as any;
});

afterAll(() => {
  // Cleanup after all tests
});
