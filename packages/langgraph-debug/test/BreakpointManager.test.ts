/**
 * Tests for BreakpointManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BreakpointManager } from '../src/BreakpointManager.js';
import type { TraceEvent } from '../src/types.js';

describe('BreakpointManager', () => {
  let manager: BreakpointManager;

  beforeEach(() => {
    manager = new BreakpointManager();
  });

  describe('Breakpoint Management', () => {
    it('should add a breakpoint', () => {
      const bp = manager.addBreakpoint({
        nodeName: 'agent1',
      });

      expect(bp).toBeDefined();
      expect(bp.node_name).toBe('agent1');
      expect(bp.enabled).toBe(true);
    });

    it('should add conditional breakpoint', () => {
      const bp = manager.addBreakpoint({
        nodeName: 'agent1',
        condition: 'state.value > 100',
      });

      expect(bp.condition).toBe('state.value > 100');
    });

    it('should remove a breakpoint', () => {
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });
      const removed = manager.removeBreakpoint(bp.breakpoint_id);

      expect(removed).toBe(true);
      expect(manager.getBreakpoint(bp.breakpoint_id)).toBeUndefined();
    });

    it('should enable/disable breakpoint', () => {
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });

      manager.disableBreakpoint(bp.breakpoint_id);
      expect(manager.getBreakpoint(bp.breakpoint_id)?.enabled).toBe(false);

      manager.enableBreakpoint(bp.breakpoint_id);
      expect(manager.getBreakpoint(bp.breakpoint_id)?.enabled).toBe(true);
    });

    it('should toggle breakpoint', () => {
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });
      const wasEnabled = manager.toggleBreakpoint(bp.breakpoint_id);

      expect(wasEnabled).toBe(false);
      expect(manager.getBreakpoint(bp.breakpoint_id)?.enabled).toBe(false);
    });

    it('should get all breakpoints', () => {
      manager.addBreakpoint({ nodeName: 'agent1' });
      manager.addBreakpoint({ nodeName: 'agent2' });

      const all = manager.getAllBreakpoints();
      expect(all.length).toBe(2);
    });

    it('should get breakpoints for node', () => {
      manager.addBreakpoint({ nodeName: 'agent1' });
      manager.addBreakpoint({ nodeName: 'agent1' });
      manager.addBreakpoint({ nodeName: 'agent2' });

      const forAgent1 = manager.getBreakpointsForNode('agent1');
      expect(forAgent1.length).toBe(2);
    });
  });

  describe('Breakpoint Hit Detection', () => {
    let bp: ReturnType<BreakpointManager['addBreakpoint']>;
    let event: TraceEvent;
    let context: {
      currentState: Record<string, unknown>;
      traceId: string;
    };

    beforeEach(() => {
      bp = manager.addBreakpoint({
        nodeName: 'agent1',
      });

      event = {
        event_id: 'evt1',
        event_type: 'node_start',
        timestamp: Date.now(),
        graph_id: 'graph1',
        trace_id: 'trace1',
        node_name: 'agent1',
        data: {},
        priority: 'medium',
        level: 'info',
      };

      context = {
        currentState: { value: 150 },
        traceId: 'trace1',
      };
    });

    it('should detect breakpoint hit', async () => {
      const hit = await manager.checkBreakpoint(event, context);

      expect(hit).toBeDefined();
      expect(hit?.breakpoint.breakpoint_id).toBe(bp.breakpoint_id);
    });

    it('should not hit disabled breakpoint', async () => {
      manager.disableBreakpoint(bp.breakpoint_id);

      const hit = await manager.checkBreakpoint(event, context);

      expect(hit).toBeNull();
    });

    it('should check conditional breakpoint', async () => {
      const conditionalBp = manager.addBreakpoint({
        nodeName: 'agent1',
        condition: 'state.value > 100',
      });

      const hit = await manager.checkBreakpoint(event, context);

      expect(hit).toBeDefined();
      expect(hit?.breakpoint.breakpoint_id).toBe(conditionalBp.breakpoint_id);
    });

    it('should not hit when condition is false', async () => {
      manager.addBreakpoint({
        nodeName: 'agent1',
        condition: 'state.value > 200',
      });

      const hit = await manager.checkBreakpoint(event, context);

      expect(hit).toBeNull();
    });

    it('should respect max hits', async () => {
      const bpWithMax = manager.addBreakpoint({
        nodeName: 'agent1',
      });
      manager.setMaxHits(bpWithMax.breakpoint_id, 2);

      // First hit
      await manager.checkBreakpoint(event, context);
      expect(manager.getBreakpoint(bpWithMax.breakpoint_id)?.enabled).toBe(true);

      // Second hit
      await manager.checkBreakpoint(event, context);
      expect(manager.getBreakpoint(bpWithMax.breakpoint_id)?.enabled).toBe(false); // Auto-disabled
    });
  });

  describe('Callbacks', () => {
    it('should call callback on breakpoint hit', async () => {
      const callback = vi.fn();
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });

      manager.onBreakpointHit(bp.breakpoint_id, callback);

      const event: TraceEvent = {
        event_id: 'evt1',
        event_type: 'node_start',
        timestamp: Date.now(),
        graph_id: 'graph1',
        trace_id: 'trace1',
        node_name: 'agent1',
        data: {},
        priority: 'medium',
        level: 'info',
      };

      await manager.checkBreakpoint(event, {
        currentState: {},
        traceId: 'trace1',
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Execution Control', () => {
    it('should pause execution', () => {
      manager.pause();
      expect(manager.isPaused()).toBe(true);
    });

    it('should resume execution', () => {
      manager.pause();
      manager.resume();
      expect(manager.isPaused()).toBe(false);
    });

    it('should step over', () => {
      manager.stepOver();
      const state = manager.getExecutionState();
      expect(state.stepMode).toBe('step_over');
    });

    it('should step into', () => {
      manager.stepInto();
      const state = manager.getExecutionState();
      expect(state.stepMode).toBe('step_into');
    });

    it('should step out', () => {
      manager.stepOut();
      const state = manager.getExecutionState();
      expect(state.stepMode).toBe('step_out');
    });

    it('should continue', () => {
      manager.continue();
      const state = manager.getExecutionState();
      expect(state.stepMode).toBe('continue');
    });
  });

  describe('Breakpoint Utilities', () => {
    beforeEach(() => {
      manager.addBreakpoint({ nodeName: 'agent1' });
      manager.addBreakpoint({ nodeName: 'agent2' });
      const bp3 = manager.addBreakpoint({ nodeName: 'agent3' });
      manager.disableBreakpoint(bp3.breakpoint_id);
    });

    it('should disable all breakpoints', () => {
      manager.disableAllBreakpoints();

      const all = manager.getAllBreakpoints();
      expect(all.every(bp => !bp.enabled)).toBe(true);
    });

    it('should enable all breakpoints', () => {
      manager.disableAllBreakpoints();
      manager.enableAllBreakpoints();

      const all = manager.getAllBreakpoints();
      expect(all.every(bp => bp.enabled)).toBe(true);
    });

    it('should clear all breakpoints', () => {
      manager.clearAllBreakpoints();

      expect(manager.getAllBreakpoints().length).toBe(0);
    });

    it('should find unhit breakpoints', () => {
      const unhit = manager.findUnhitBreakpoints();
      expect(unhit.length).toBe(3);
    });

    it('should clone breakpoint', () => {
      const original = manager.addBreakpoint({ nodeName: 'agent1' });
      const cloned = manager.cloneBreakpoint(original.breakpoint_id);

      expect(cloned).toBeDefined();
      expect(cloned?.breakpoint_id).not.toBe(original.breakpoint_id);
      expect(cloned?.node_name).toBe(original.node_name);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const bp1 = manager.addBreakpoint({ nodeName: 'agent1' });
      const bp2 = manager.addBreakpoint({ nodeName: 'agent2' });
      manager.disableBreakpoint(bp2.breakpoint_id);
    });

    it('should get statistics', () => {
      const stats = manager.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
    });

    it('should get hit count', () => {
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });

      expect(manager.getHitCount(bp.breakpoint_id)).toBe(0);
    });

    it('should get hit history', () => {
      const history = manager.getHitHistory();
      expect(history).toBeInstanceOf(Map);
    });

    it('should clear hit history', () => {
      manager.addBreakpoint({ nodeName: 'agent1' });
      manager.clearHitHistory();

      const all = manager.getAllBreakpoints();
      expect(all.every(bp => bp.hit_count === 0)).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate valid breakpoint', () => {
      const bp = manager.addBreakpoint({
        nodeName: 'agent1',
        condition: 'state.value > 10',
      });

      const result = manager.validateBreakpoint(bp);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate breakpoint without target', () => {
      const bp = manager.addBreakpoint({});

      const result = manager.validateBreakpoint(bp);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate invalid condition', () => {
      const bp = manager.addBreakpoint({
        nodeName: 'agent1',
        condition: 'invalid syntax here',
      });

      const result = manager.validateBreakpoint(bp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition'))).toBe(true);
    });

    it('should validate invalid max hits', () => {
      const bp = manager.addBreakpoint({
        nodeName: 'agent1',
      });
      bp.max_hits = -1;

      const result = manager.validateBreakpoint(bp);

      expect(result.valid).toBe(false);
    });
  });

  describe('Expression Parsing', () => {
    it('should create breakpoint from expression', () => {
      const bp = manager.createBreakpointFromExpression('break at agent1');

      expect(bp).toBeDefined();
      expect(bp?.node_name).toBe('agent1');
    });

    it('should create conditional breakpoint from expression', () => {
      const bp = manager.createBreakpointFromExpression('break at agent1 when state.value > 10');

      expect(bp?.node_name).toBe('agent1');
      expect(bp?.condition).toBe('state.value > 10');
    });

    it('should return null for invalid expression', () => {
      const bp = manager.createBreakpointFromExpression('invalid expression');

      expect(bp).toBeNull();
    });
  });

  describe('Update Operations', () => {
    it('should update breakpoint condition', () => {
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });

      const success = manager.updateCondition(bp.breakpoint_id, 'state.value > 200');

      expect(success).toBe(true);
      expect(manager.getBreakpoint(bp.breakpoint_id)?.condition).toBe('state.value > 200');
    });

    it('should set max hits', () => {
      const bp = manager.addBreakpoint({ nodeName: 'agent1' });

      const success = manager.setMaxHits(bp.breakpoint_id, 5);

      expect(success).toBe(true);
      expect(manager.getBreakpoint(bp.breakpoint_id)?.max_hits).toBe(5);
    });
  });

  describe('Export/Import', () => {
    it('should export breakpoints', () => {
      manager.addBreakpoint({ nodeName: 'agent1' });
      manager.addBreakpoint({ nodeName: 'agent2' });

      const exported = manager.exportBreakpoints();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should import breakpoints', () => {
      const jsonData = JSON.stringify([
        {
          breakpoint_id: 'imported1',
          node_name: 'agent1',
          enabled: true,
          hit_count: 0,
          created_at: Date.now(),
        },
      ]);

      const imported = manager.importBreakpoints(jsonData);

      expect(imported.length).toBe(1);
      expect(imported[0].node_name).toBe('agent1');
    });
  });
});
