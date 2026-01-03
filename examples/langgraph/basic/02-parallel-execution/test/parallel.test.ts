/**
 * Tests for Example 02: Parallel Execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createParallelGraph, runParallelExample } from '../index.js';

describe('Example 02: Parallel Execution', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createParallelGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('Task Splitting', () => {
    it('should split input into parallel tasks', async () => {
      const result = await runParallelExample('Analyze data');
      expect(result.tasks).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);
    });

    it('should create multiple task types', async () => {
      const result = await runParallelExample('Process text');
      expect(result.tasks?.some(t => t.includes('sentiment'))).toBe(true);
      expect(result.tasks?.some(t => t.includes('keyword'))).toBe(true);
      expect(result.tasks?.some(t => t.includes('entity'))).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute tasks in parallel', async () => {
      const start = Date.now();
      const result = await runParallelExample('Analyze data');
      const duration = Date.now() - start;

      expect(result.results).toBeDefined();
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(1000);
    });

    it('should collect results from all tasks', async () => {
      const result = await runParallelExample('Process data');
      const resultCount = Object.keys(result.results || {}).length;

      expect(resultCount).toBeGreaterThan(0);
    });
  });

  describe('Result Merging', () => {
    it('should merge results into final output', async () => {
      const result = await runParallelExample('Analyze text');
      expect(result.merged).toBeDefined();
      expect(result.merged).toContain('Parallel Analysis Complete');
    });

    it('should include all task results in merge', async () => {
      const result = await runParallelExample('Process text');
      const results = result.results || {};

      Object.keys(results).forEach(task => {
        expect(result.merged).toContain(task);
      });
    });
  });

  describe('Result Types', () => {
    it('should generate sentiment results', async () => {
      const result = await runParallelExample('Analyze text');
      const sentimentTask = Object.keys(result.results || {}).find(k => k.includes('sentiment'));

      expect(sentimentTask).toBeDefined();
      if (sentimentTask) {
        const sentimentResult = result.results?.[sentimentTask] as Record<string, unknown>;
        expect(sentimentResult?.sentiment).toMatch(/positive|negative/);
      }
    });

    it('should generate keyword results', async () => {
      const result = await runParallelExample('Analyze text');
      const keywordTask = Object.keys(result.results || {}).find(k => k.includes('keyword'));

      expect(keywordTask).toBeDefined();
      if (keywordTask) {
        const keywordResult = result.results?.[keywordTask] as Record<string, unknown>;
        expect(Array.isArray(keywordResult?.keywords)).toBe(true);
      }
    });

    it('should generate entity results', async () => {
      const result = await runParallelExample('Analyze text');
      const entityTask = Object.keys(result.results || {}).find(k => k.includes('entity'));

      expect(entityTask).toBeDefined();
      if (entityTask) {
        const entityResult = result.results?.[entityTask] as Record<string, unknown>;
        expect(Array.isArray(entityResult?.entities)).toBe(true);
      }
    });
  });

  describe('Performance', () => {
    it('should complete faster than sequential execution', async () => {
      const start = Date.now();
      await runParallelExample('Analyze data');
      const duration = Date.now() - start;

      // With 3 tasks in parallel, should be much faster than 3*200ms sequential
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple concurrent requests', async () => {
      const inputs = ['Analyze text 1', 'Analyze text 2', 'Analyze text 3'];
      const start = Date.now();

      const results = await Promise.all(
        inputs.map(input => runParallelExample(input))
      );

      const duration = Date.now() - start;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result?.merged).toBeDefined();
      });

      // Concurrent execution should still be efficient
      expect(duration).toBeLessThan(1500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await runParallelExample('');
      expect(result).toBeDefined();
      expect(result.tasks).toBeDefined();
    });

    it('should handle very long input', async () => {
      const longInput = 'Analyze '.repeat(100) + 'data';
      const result = await runParallelExample(longInput);
      expect(result).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should preserve original input', async () => {
      const input = 'Analyze data';
      const result = await runParallelExample(input);
      expect(result.input).toBe(input);
    });

    it('should accumulate results correctly', async () => {
      const result = await runParallelExample('Process text');
      expect(Object.keys(result.results || {}).length).toBeGreaterThan(0);
    });
  });
});
