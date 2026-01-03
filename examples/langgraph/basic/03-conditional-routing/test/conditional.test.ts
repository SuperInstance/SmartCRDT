/**
 * Tests for Example 03: Conditional Routing
 */

import { describe, it, expect } from 'vitest';
import { createConditionalRoutingGraph, runConditionalRoutingExample } from '../index.js';

describe('Example 03: Conditional Routing', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createConditionalRoutingGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('Positive Sentiment Routing', () => {
    it('should detect positive sentiment', async () => {
      const result = await runConditionalRoutingExample('I love this product!');
      expect(result.sentiment).toBe('positive');
    });

    it('should route to positive handler', async () => {
      const result = await runConditionalRoutingExample('This is great and amazing!');
      expect(result.metadata?.route).toBe('positive');
    });

    it('should generate positive response', async () => {
      const result = await runConditionalRoutingExample('Thank you for the excellent service');
      expect(result.output).toContain('positive feedback');
      expect(result.output).toContain('glad');
    });
  });

  describe('Negative Sentiment Routing', () => {
    it('should detect negative sentiment', async () => {
      const result = await runConditionalRoutingExample('I hate this product!');
      expect(result.sentiment).toBe('negative');
    });

    it('should route to negative handler', async () => {
      const result = await runConditionalRoutingExample('This is terrible and bad!');
      expect(result.metadata?.route).toBe('negative');
    });

    it('should generate apology response', async () => {
      const result = await runConditionalRoutingExample('I am very frustrated and angry');
      expect(result.output).toContain('sorry');
      expect(result.output).toContain('make things right');
    });
  });

  describe('Neutral Sentiment Routing', () => {
    it('should detect neutral sentiment', async () => {
      const result = await runConditionalRoutingExample('Can you help me?');
      expect(result.sentiment).toBe('neutral');
    });

    it('should route to neutral handler', async () => {
      const result = await runConditionalRoutingExample('What are your prices?');
      expect(result.metadata?.route).toBe('neutral');
    });

    it('should generate neutral response', async () => {
      const result = await runConditionalRoutingExample('Tell me about your features');
      expect(result.output).toContain('received');
      expect(result.output).toContain('help');
    });
  });

  describe('Mixed Sentiment Handling', () => {
    it('should prioritize negative when both present', async () => {
      const result = await runConditionalRoutingExample('This is good but also terrible');
      expect(result.sentiment).toBe('negative');
    });

    it('should handle mild sentiment', async () => {
      const result = await runConditionalRoutingExample('It is okay');
      expect(result.sentiment).toBe('neutral');
    });
  });

  describe('Routing Logic', () => {
    it('should correctly route all positive words', async () => {
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'happy'];

      for (const word of positiveWords) {
        const result = await runConditionalRoutingExample(`This is ${word}`);
        expect(result.sentiment).toBe('positive');
      }
    });

    it('should correctly route all negative words', async () => {
      const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'frustrated'];

      for (const word of negativeWords) {
        const result = await runConditionalRoutingExample(`This is ${word}`);
        expect(result.sentiment).toBe('negative');
      }
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runConditionalRoutingExample('Analyze this');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple rapid requests', async () => {
      const inputs = ['Great!', 'Terrible!', 'Okay?'];
      const results = await Promise.all(
        inputs.map(input => runConditionalRoutingExample(input))
      );

      expect(results).toHaveLength(3);
      expect(results[0]?.sentiment).toBe('positive');
      expect(results[1]?.sentiment).toBe('negative');
      expect(results[2]?.sentiment).toBe('neutral');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await runConditionalRoutingExample('');
      expect(result).toBeDefined();
      expect(result.sentiment).toBe('neutral');
    });

    it('should handle special characters', async () => {
      const result = await runConditionalRoutingExample('This is great!!! @#$%');
      expect(result.sentiment).toBe('positive');
    });

    it('should handle case insensitivity', async () => {
      const result1 = await runConditionalRoutingExample('This is GREAT');
      const result2 = await runConditionalRoutingExample('This is great');
      expect(result1.sentiment).toBe(result2.sentiment);
    });
  });

  describe('State Management', () => {
    it('should preserve original input', async () => {
      const input = 'I love this!';
      const result = await runConditionalRoutingExample(input);
      expect(result.input).toBe(input);
    });

    it('should include route metadata', async () => {
      const result = await runConditionalRoutingExample('This is great');
      expect(result.metadata?.route).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });
});
