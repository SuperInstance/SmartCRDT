/**
 * Tests for Example 01: Simple Sequential Flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSequentialGraph, runSequentialExample } from '../index.js';
import { SequentialState } from '../config.js';

describe('Example 01: Simple Sequential Flow', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createSequentialGraph();
      expect(graph).toBeDefined();
    });

    it('should have the correct nodes', () => {
      const graph = createSequentialGraph();
      const graphStructure = graph.getName();
      expect(graphStructure).toBeDefined();
    });
  });

  describe('Sequential Execution', () => {
    it('should process sales analysis input', async () => {
      const input = 'Analyze the sales data for Q4 2024';
      const result = await runSequentialExample(input);

      expect(result).toBeDefined();
      expect(result.parsed).toBeDefined();
      expect(result.analyzed).toBeDefined();
      expect(result.output).toBeDefined();
      expect(result.parsed?.topic).toBe('sales');
    });

    it('should process customer report input', async () => {
      const input = 'Generate a customer report for last month';
      const result = await runSequentialExample(input);

      expect(result).toBeDefined();
      expect(result.parsed?.topic).toBe('customer');
      expect(result.parsed?.type).toBe('report');
    });

    it('should process product comparison input', async () => {
      const input = 'Compare product inventory this week';
      const result = await runSequentialExample(input);

      expect(result).toBeDefined();
      expect(result.parsed?.topic).toBe('product');
      expect(result.parsed?.type).toBe('comparison');
    });

    it('should handle general queries', async () => {
      const input = 'What are the key metrics for today?';
      const result = await runSequentialExample(input);

      expect(result).toBeDefined();
      expect(result.parsed?.topic).toBe('general');
    });
  });

  describe('Parser Agent', () => {
    it('should extract topic from input', async () => {
      const result = await runSequentialExample('Analyze sales data');
      expect(result.parsed?.topic).toBe('sales');
    });

    it('should extract time period from input', async () => {
      const result = await runSequentialExample('Analyze Q4 2024');
      expect(result.parsed?.period).toBe('Q4 2024');
    });

    it('should extract action type from input', async () => {
      const result = await runSequentialExample('Compare the results');
      expect(result.parsed?.type).toBe('comparison');
    });
  });

  describe('Analyzer Agent', () => {
    it('should generate analysis data', async () => {
      const result = await runSequentialExample('Analyze sales');
      expect(result.analyzed?.dataPoints).toBeGreaterThan(0);
    });

    it('should include trend for sales analysis', async () => {
      const result = await runSequentialExample('Analyze sales data');
      expect(result.analyzed?.trend).toMatch(/upward|stable|downward/);
    });

    it('should include customer metrics for customer topic', async () => {
      const result = await runSequentialExample('Analyze customer data');
      expect(result.analyzed?.totalCustomers).toBeGreaterThan(0);
    });
  });

  describe('Responder Agent', () => {
    it('should generate contextual response', async () => {
      const result = await runSequentialExample('Analyze sales for Q4 2024');
      expect(result.output).toBeDefined();
      expect(result.output).toContain('Q4 2024');
      expect(result.output).toContain('sales');
    });

    it('should include analysis findings', async () => {
      const result = await runSequentialExample('Analyze sales data');
      expect(result.output).toBeDefined();
      expect(result.output.length).toBeGreaterThan(50);
    });
  });

  describe('Metadata Tracking', () => {
    it('should track parser completion', async () => {
      const result = await runSequentialExample('Analyze data');
      expect(result.metadata?.parserCompleted).toBe(true);
    });

    it('should track analyzer completion', async () => {
      const result = await runSequentialExample('Analyze data');
      expect(result.metadata?.analyzerCompleted).toBe(true);
    });

    it('should track responder completion', async () => {
      const result = await runSequentialExample('Analyze data');
      expect(result.metadata?.responderCompleted).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await runSequentialExample('');
      expect(result).toBeDefined();
    });

    it('should handle very long input', async () => {
      const longInput = 'Analyze '.repeat(100) + 'sales data';
      const result = await runSequentialExample(longInput);
      expect(result).toBeDefined();
    });

    it('should handle special characters', async () => {
      const result = await runSequentialExample('Analyze sales @#$% data for Q4!');
      expect(result).toBeDefined();
    });
  });

  describe('State Preservation', () => {
    it('should preserve original input', async () => {
      const input = 'Analyze sales data';
      const result = await runSequentialExample(input);
      expect(result.input).toBe(input);
    });

    it('should accumulate metadata across agents', async () => {
      const result = await runSequentialExample('Analyze data');
      expect(result.metadata?.parserCompleted).toBe(true);
      expect(result.metadata?.analyzerCompleted).toBe(true);
      expect(result.metadata?.responderCompleted).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runSequentialExample('Analyze sales data');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in < 1s
    });

    it('should handle multiple sequential requests', async () => {
      const inputs = ['Analyze sales', 'Analyze customers', 'Analyze products'];
      const results = await Promise.all(
        inputs.map(input => runSequentialExample(input))
      );
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result?.output).toBeDefined();
      });
    });
  });
});
