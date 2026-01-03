/**
 * Tests for Example 04: Human-in-the-Loop
 */

import { describe, it, expect } from 'vitest';
import { createHumanInTheLoopGraph, runHumanInTheLoopExample } from '../index.js';

describe('Example 04: Human-in-the-Loop', () => {
  describe('Graph Structure', () => {
    it('should create a valid graph', () => {
      const graph = createHumanInTheLoopGraph();
      expect(graph).toBeDefined();
    });
  });

  describe('Draft Generation', () => {
    it('should generate a draft', async () => {
      const result = await runHumanInTheLoopExample('Test input', false);
      expect(result.draft).toBeDefined();
      expect(result.draft).toContain('Draft Response');
    });

    it('should include original input in draft', async () => {
      const input = 'Deploy changes';
      const result = await runHumanInTheLoopExample(input, false);
      expect(result.draft).toContain(input);
    });

    it('should set status to awaiting_approval', async () => {
      const result = await runHumanInTheLoopExample('Test input', false);
      expect(result.status).toBe('awaiting_approval');
    });
  });

  describe('Approved Workflow', () => {
    it('should execute when approved', async () => {
      const result = await runHumanInTheLoopExample('Execute task', true);
      expect(result.status).toBe('approved');
      expect(result.output).toContain('Action Executed Successfully');
    });

    it('should include draft in output when approved', async () => {
      const result = await runHumanInTheLoopExample('Execute task', true);
      expect(result.output).toContain('Approved Draft');
    });

    it('should mark as executed in metadata', async () => {
      const result = await runHumanInTheLoopExample('Execute task', true);
      expect(result.metadata?.executed).toBe(true);
    });
  });

  describe('Rejected Workflow', () => {
    it('should handle rejection gracefully', async () => {
      const result = await runHumanInTheLoopExample('Execute task', false);
      expect(result.status).toBe('rejected');
    });

    it('should provide rejection message', async () => {
      const result = await runHumanInTheLoopExample('Execute task', false);
      expect(result.output).toContain('Action Not Approved');
    });

    it('should mark as rejected in metadata', async () => {
      const result = await runHumanInTheLoopExample('Execute task', false);
      expect(result.metadata?.rejected).toBe(true);
    });
  });

  describe('Approval Routing', () => {
    it('should route to execute when approved', async () => {
      const result = await runHumanInTheLoopExample('Task', true);
      expect(result.status).toBe('approved');
      expect(result.output).toContain('COMPLETED');
    });

    it('should route to reject when not approved', async () => {
      const result = await runHumanInTheLoopExample('Task', false);
      expect(result.status).toBe('rejected');
    });
  });

  describe('State Transitions', () => {
    it('should transition from pending to awaiting_approval', async () => {
      const result = await runHumanInTheLoopExample('Test', false);
      expect(result.metadata?.draftGenerated).toBe(true);
    });

    it('should transition from awaiting_approval to approved', async () => {
      const result = await runHumanInTheLoopExample('Test', true);
      expect(result.metadata?.approvalGranted).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await runHumanInTheLoopExample('Test', true);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple requests', async () => {
      const requests = [
        { input: 'Task 1', approved: true },
        { input: 'Task 2', approved: false },
        { input: 'Task 3', approved: true },
      ];

      const results = await Promise.all(
        requests.map(r => runHumanInTheLoopExample(r.input, r.approved))
      );

      expect(results).toHaveLength(3);
      expect(results[0]?.status).toBe('approved');
      expect(results[1]?.status).toBe('rejected');
      expect(results[2]?.status).toBe('approved');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await runHumanInTheLoopExample('', true);
      expect(result).toBeDefined();
    });

    it('should handle very long input', async () => {
      const longInput = 'Deploy '.repeat(100) + 'changes';
      const result = await runHumanInTheLoopExample(longInput, false);
      expect(result).toBeDefined();
      expect(result.draft).toBeDefined();
    });
  });

  describe('Metadata Tracking', () => {
    it('should include timestamp in metadata', async () => {
      const result = await runHumanInTheLoopExample('Test', true);
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should include completion time when executed', async () => {
      const result = await runHumanInTheLoopExample('Test', true);
      expect(result.metadata?.completedAt).toBeDefined();
    });

    it('should include rejection time when rejected', async () => {
      const result = await runHumanInTheLoopExample('Test', false);
      expect(result.metadata?.rejectedAt).toBeDefined();
    });
  });

  describe('Output Formatting', () => {
    it('should format approved output correctly', async () => {
      const result = await runHumanInTheLoopExample('Deploy changes', true);
      expect(result.output).toContain('Original Request');
      expect(result.output).toContain('Status: COMPLETED');
    });

    it('should format rejected output correctly', async () => {
      const result = await runHumanInTheLoopExample('Deploy changes', false);
      expect(result.output).toContain('Action Not Approved');
    });
  });
});
