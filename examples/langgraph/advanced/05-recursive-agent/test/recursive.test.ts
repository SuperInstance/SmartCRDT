/**
 * Tests for Example 05: Recursive Agent
 */

import { describe, it, expect } from 'vitest';
import { createRecursiveAgentGraph, runRecursiveAgentExample } from '../index.js';

describe('Example 05: Recursive Agent', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createRecursiveAgentGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('Recursive Execution', () => {
    it('should iterate multiple times', async () => {
      const result = await runRecursiveAgentExample('Test task', 5);
      expect(result.iteration).toBeGreaterThan(0);
    });

    it('should stop at max iterations', async () => {
      const maxIterations = 3;
      const result = await runRecursiveAgentExample('Test task', maxIterations);
      expect(result.iteration).toBeLessThanOrEqual(maxIterations);
    });

    it('should track progress across iterations', async () => {
      const result = await runRecursiveAgentExample('Test task', 5);
      expect(result.progress).toBeGreaterThan(0);
    });
  });

  describe('Base Condition', () => {
    it('should complete when progress reaches 100%', async () => {
      const result = await runRecursiveAgentExample('Quick task', 10);
      if (result.progress >= 100) {
        expect(result.completed).toBe(true);
      }
    });

    it('should complete at max iterations', async () => {
      const maxIterations = 2;
      const result = await runRecursiveAgentExample('Test task', maxIterations);
      expect(result.iteration).toBe(maxIterations);
    });
  });

  describe('Output Generation', () => {
    it('should generate final output', async () => {
      const result = await runRecursiveAgentExample('Test task', 3);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('Task Completed');
    });

    it('should include iteration count in output', async () => {
      const result = await runRecursiveAgentExample('Test task', 5);
      expect(result.output).toContain('Iterations:');
    });

    it('should include progress in output', async () => {
      const result = await runRecursiveAgentExample('Test task', 5);
      expect(result.output).toContain('Progress:');
    });
  });

  describe('State Management', () => {
    it('should preserve input across iterations', async () => {
      const input = 'Test input';
      const result = await runRecursiveAgentExample(input, 5);
      expect(result.input).toBe(input);
    });

    it('should track metadata correctly', async () => {
      const result = await runRecursiveAgentExample('Test task', 3);
      expect(result.metadata?.lastIteration).toBeDefined();
      expect(result.metadata?.lastUpdate).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runRecursiveAgentExample('Test task', 5);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxIterations of 1', async () => {
      const result = await runRecursiveAgentExample('Test task', 1);
      expect(result.iteration).toBe(1);
    });

    it('should handle empty input', async () => {
      const result = await runRecursiveAgentExample('', 3);
      expect(result).toBeDefined();
    });
  });
});
