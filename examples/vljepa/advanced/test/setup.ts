import { beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
beforeEach(() => {
  cleanup();
});

// Mock Web Speech API
global.SpeechRecognition = class SpeechRecognition {
  continuous = true;
  interimResults = true;
  lang = 'en-US';
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: ((event: any) => void) | null = null;

  start() {
    setTimeout(() => {
      if (this.onresult) {
        this.onresult({
          results: [
            {
              0: { transcript: 'make the button blue', confidence: 0.95 },
              length: 1
            }
          ],
          resultIndex: 0
        });
      }
    }, 100);
  }

  stop() {}
} as any;

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;
