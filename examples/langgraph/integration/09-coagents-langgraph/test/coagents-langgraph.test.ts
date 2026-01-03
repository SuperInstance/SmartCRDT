/**
 * Tests for Example 09: CoAgents + LangGraph Integration
 */

import { describe, it, expect } from 'vitest';
import { createCoAgentsLangGraphGraph, runCoAgentsLangGraphExample } from '../index.js';

describe('Example 09: CoAgents + LangGraph Integration', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createCoAgentsLangGraphGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('Checkpoint System', () => {
    it('should create checkpoint on first execution', async () => {
      const result = await runCoAgentsLangGraphExample('Test input');
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint).toContain('CHECKPOINT');
    });

    it('should include checkpoint ID in metadata', async () => {
      const result = await runCoAgentsLangGraphExample('Test');
      expect(result.metadata?.checkpointId).toBeDefined();
      expect(result.metadata?.checkpointId).toMatch(/^cp_/);
    });

    it('should resume with human feedback', async () => {
      const result = await runCoAgentsLangGraphExample('Test', 'Make it better');
      expect(result.output).toBeDefined();
      expect(result.output).toContain('Hybrid CoAgents + LangGraph');
    });
  });

  describe('Human-in-the-Loop', () => {
    it('should wait for feedback when not provided', async () => {
      const result = await runCoAgentsLangGraphExample('Test');
      expect(result.checkpoint).toContain('awaiting human feedback');
    });

    it('should incorporate feedback when provided', async () => {
      const feedback = 'Make it more professional';
      const result = await runCoAgentsLangGraphExample('Test', feedback);
      expect(result.output).toContain(feedback);
    });
  });

  describe('Hybrid Integration', () => {
    it('should combine frontend and backend', async () => {
      const result = await runCoAgentsLangGraphExample('Test');
      expect(result.metadata).toBeDefined();
      expect(result.output).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runCoAgentsLangGraphExample('Test');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('State Management', () => {
    it('should preserve input across checkpoint', async () => {
      const input = 'Test input';
      const result = await runCoAgentsLangGraphExample(input);
      expect(result.input).toBe(input);
    });

    it('should track checkpoint state', async () => {
      const result = await runCoAgentsLangGraphExample('Test');
      expect(result.metadata?.checkpointReached).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty feedback', async () => {
      const result = await runCoAgentsLangGraphExample('Test', '');
      expect(result).toBeDefined();
    });

    it('should handle long feedback', async () => {
      const longFeedback = 'Make it better. '.repeat(50);
      const result = await runCoAgentsLangGraphExample('Test', longFeedback);
      expect(result).toBeDefined();
    });
  });
});
