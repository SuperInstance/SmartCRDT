/**
 * Tests for Example 06: Hierarchical Agents
 */

import { describe, it, expect } from 'vitest';
import { createHierarchicalGraph, runHierarchicalAgentsExample } from '../index.js';

describe('Example 06: Hierarchical Agents', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createHierarchicalGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('Sub-graph Execution', () => {
    it('should execute data processing sub-graph', async () => {
      const result = await runHierarchicalAgentsExample('Process data');
      expect(result.output).toContain('Data Processing');
    });

    it('should execute analysis sub-graph', async () => {
      const result = await runHierarchicalAgentsExample('Analyze data');
      expect(result.output).toContain('Analysis');
    });

    it('should execute reporting sub-graph', async () => {
      const result = await runHierarchicalAgentsExample('Generate report');
      expect(result.output).toContain('Reporting');
    });
  });

  describe('Coordination', () => {
    it('should coordinate all sub-graphs', async () => {
      const result = await runHierarchicalAgentsExample('Full pipeline');
      expect(result.output).toContain('Complete');
      expect(result.metadata?.coordination).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runHierarchicalAgentsExample('Test');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('State Management', () => {
    it('should preserve input', async () => {
      const input = 'Test input';
      const result = await runHierarchicalAgentsExample(input);
      expect(result.input).toBe(input);
    });
  });

  describe('Output Format', () => {
    it('should include all sub-graphs in output', async () => {
      const result = await runHierarchicalAgentsExample('Test');
      expect(result.output).toContain('Data Processing');
      expect(result.output).toContain('Analysis');
      expect(result.output).toContain('Reporting');
    });
  });
});
