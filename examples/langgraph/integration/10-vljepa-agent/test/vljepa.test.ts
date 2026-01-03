/**
 * Tests for Example 10: VL-JEPA Visual Understanding Agent
 */

import { describe, it, expect } from 'vitest';
import { createVLJEPAAgentGraph, runVLJEPAAgentExample } from '../index.js';

describe('Example 10: VL-JEPA Visual Understanding Agent', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createVLJEPAAgentGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('X-Encoder (Visual)', () => {
    it('should generate 768-dim visual embedding', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.visualEmbedding).toBeDefined();
      expect(result.visualEmbedding?.length).toBe(768);
    });

    it('should complete X-encoding', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.metadata?.xEncoderComplete).toBe(true);
    });

    it('should include embedding dimension in metadata', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.metadata?.embeddingDim).toBe(768);
    });
  });

  describe('Y-Encoder (Intent)', () => {
    it('should generate 768-dim intent embedding', async () => {
      const result = await runVLJEPAAgentExample('Make button pop');
      expect(result.userIntent).toBeDefined();
      expect(result.userIntent?.length).toBe(768);
    });

    it('should complete Y-encoding', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.metadata?.yEncoderComplete).toBe(true);
    });
  });

  describe('Predictor', () => {
    it('should combine embeddings', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.prediction).toBeDefined();
      expect(result.prediction).toContain('VL-JEPA Prediction');
    });

    it('should include confidence score', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.metadata?.confidence).toBeDefined();
      expect(result.metadata?.confidence).toBeGreaterThan(0);
      expect(result.metadata?.confidence).toBeLessThanOrEqual(1);
    });

    it('should predict action type', async () => {
      const result = await runVLJEPAAgentExample('Modify button');
      expect(result.prediction).toContain('Recommended Action');
    });
  });

  describe('Execution', () => {
    it('should execute predicted action', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.output).toBeDefined();
      expect(result.output).toContain('VL-JEPA Agent Execution Complete');
    });

    it('should include execution metadata', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.metadata?.executionComplete).toBe(true);
    });
  });

  describe('Visual Understanding', () => {
    it('should analyze UI frame', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.prediction).toContain('Visual Context');
    });

    it('should process user intent', async () => {
      const result = await runVLJEPAAgentExample('Make button pop');
      expect(result.prediction).toContain('User Intent');
    });
  });

  describe('Embedding Quality', () => {
    it('should generate valid embedding values', async () => {
      const result = await runVLJEPAAgentExample('Test');
      result.visualEmbedding?.forEach(v => {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    it('should have consistent embedding dimensions', async () => {
      const result1 = await runVLJEPAAgentExample('Test 1');
      const result2 = await runVLJEPAAgentExample('Test 2');
      expect(result1.visualEmbedding?.length).toBe(result2.visualEmbedding?.length);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runVLJEPAAgentExample('Test');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple requests', async () => {
      const inputs = ['Modify button', 'Change color', 'Add animation'];
      const results = await Promise.all(
        inputs.map(input => runVLJEPAAgentExample(input))
      );
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.visualEmbedding).toBeDefined();
        expect(result.userIntent).toBeDefined();
      });
    });
  });

  describe('Output Format', () => {
    it('should include analysis steps in output', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.output).toContain('Analyzed the UI frame');
      expect(result.output).toContain('Encoded your intent');
      expect(result.output).toContain('Predicted the optimal action');
    });

    it('should show confidence in output', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.output).toMatch(/\d+\.\d+% confidence/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await runVLJEPAAgentExample('');
      expect(result).toBeDefined();
    });

    it('should handle very long input', async () => {
      const longInput = 'Modify '.repeat(100);
      const result = await runVLJEPAAgentExample(longInput);
      expect(result).toBeDefined();
    });
  });

  describe('State Preservation', () => {
    it('should preserve original input', async () => {
      const input = 'Make button pop';
      const result = await runVLJEPAAgentExample(input);
      expect(result.input).toBe(input);
    });
  });
});
