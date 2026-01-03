/**
 * Tests for DebugConsole
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DebugConsole } from '../src/DebugConsole.js';
import type { DebugConsoleContext, ExecutionTrace } from '../src/types.js';

describe('DebugConsole', () => {
  let console: DebugConsole;
  let mockContext: Partial<DebugConsoleContext>;

  beforeEach(() => {
    console = new DebugConsole();
    mockContext = {
      current_state: {
        user: { name: 'Alice', age: 30 },
        counter: 42,
      },
      active_trace: undefined,
      available_commands: [],
      variables: { temp: 'value' },
    };
  });

  describe('Command Execution', () => {
    it('should execute help command', async () => {
      const result = await console.executeCommand('help');

      expect(result).toContain('Available commands');
    });

    it('should execute state command', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('state');

      expect(result).toBeDefined();
    });

    it('should execute get command', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('get user.name');

      expect(result).toBe('Alice');
    });

    it('should execute set command', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('set user.name Bob');

      expect(result).toContain('Bob');
    });

    it('should execute vars command', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('vars');

      expect(result).toBeDefined();
    });

    it('should execute eval command', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('eval counter + 10');

      expect(result).toBe(52);
    });

    it('should execute history command', async () => {
      await console.executeCommand('help');
      const result = await console.executeCommand('history');

      expect(result).toBeDefined();
    });

    it('should execute clear command', async () => {
      await console.executeCommand('clear');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should return null for empty command', async () => {
      const result = await console.executeCommand('');
      expect(result).toBeNull();
    });

    it('should throw error for unknown command', async () => {
      await expect(console.executeCommand('unknown command')).rejects.toThrow();
    });
  });

  describe('Command History', () => {
    it('should record command history', async () => {
      await console.executeCommand('help');
      await console.executeCommand('state');

      const history = console.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].command).toBe('help');
      expect(history[1].command).toBe('state');
    });

    it('should track command duration', async () => {
      await console.executeCommand('help');

      const history = console.getHistory();
      expect(history[0].duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should track command errors', async () => {
      try {
        await console.executeCommand('invalid');
      } catch (e) {
        // Expected
      }

      const history = console.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry.error).toBeDefined();
    });

    it('should limit history size', async () => {
      // Execute more than 1000 commands
      for (let i = 0; i < 1100; i++) {
        await console.executeCommand('help');
      }

      const history = console.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should get limited history', async () => {
      for (let i = 0; i < 10; i++) {
        await console.executeCommand('help');
      }

      const history = console.getHistory(5);
      expect(history.length).toBe(5);
    });

    it('should clear history', () => {
      console.clearHistory();
      expect(console.getHistory().length).toBe(0);
    });
  });

  describe('Context Management', () => {
    it('should update context', () => {
      console.updateContext(mockContext);

      const context = console.getContext();
      expect(context.current_state).toEqual(mockContext.current_state);
    });

    it('should merge context updates', () => {
      console.updateContext({ current_state: { value: 1 } });
      console.updateContext({ current_state: { value: 2 } });

      expect(console.getContext().current_state).toEqual({ value: 2 });
    });

    it('should get context snapshot', () => {
      console.updateContext(mockContext);

      const context = console.getContext();
      expect(context).toBeDefined();
      expect(context.current_state).toBeDefined();
    });
  });

  describe('Command Parsing', () => {
    it('should parse simple command', async () => {
      const result = await console.executeCommand('help');
      expect(result).toBeDefined();
    });

    it('should parse command with arguments', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('get user.name');

      expect(result).toBe('Alice');
    });

    it('should parse quoted arguments', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('set user.name "Alice Smith"');

      expect(result).toContain('Alice Smith');
    });

    it('should parse escaped quotes', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('set user.name "Alice \\"Smith\\""');

      expect(result).toContain('Alice "Smith"');
    });
  });

  describe('Custom Commands', () => {
    it('should register custom command', async () => {
      let called = false;
      console.registerCommand('test', async () => {
        called = true;
        return 'test result';
      });

      const result = await console.executeCommand('test');

      expect(called).toBe(true);
      expect(result).toBe('test result');
    });

    it('should pass arguments to custom command', async () => {
      let receivedArgs: string[] = [];
      console.registerCommand('test', async (args) => {
        receivedArgs = args;
        return 'ok';
      });

      await console.executeCommand('test arg1 arg2');

      expect(receivedArgs).toEqual(['arg1', 'arg2']);
    });

    it('should pass context to custom command', async () => {
      let receivedContext: DebugConsoleContext | undefined;
      console.updateContext(mockContext);
      console.registerCommand('test', async (_args, context) => {
        receivedContext = context;
        return 'ok';
      });

      await console.executeCommand('test');

      expect(receivedContext).toBeDefined();
      expect(receivedContext?.current_state).toEqual(mockContext.current_state);
    });

    it('should register command aliases', async () => {
      console.registerCommand('testcmd', async () => 'result', ['t', 'tc']);

      expect(await console.executeCommand('testcmd')).toBe('result');
      expect(await console.executeCommand('t')).toBe('result');
      expect(await console.executeCommand('tc')).toBe('result');
    });

    it('should resolve aliases correctly', async () => {
      let executed = false;
      console.registerCommand('fullcommand', async () => {
        executed = true;
        return 'ok';
      }, ['fc']);

      await console.executeCommand('fc');

      expect(executed).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', async () => {
      await console.executeCommand('help');
      await console.executeCommand('state');

      const stats = console.getStatistics();

      expect(stats.totalCommands).toBe(2);
      expect(stats.successfulCommands).toBe(2);
      expect(stats.failedCommands).toBe(0);
      expect(stats.avgCommandTime).toBeGreaterThan(0);
    });

    it('should count failed commands', async () => {
      try {
        await console.executeCommand('invalid');
      } catch (e) {
        // Expected
      }

      const stats = console.getStatistics();
      expect(stats.failedCommands).toBe(1);
    });
  });

  describe('State Operations', () => {
    beforeEach(() => {
      console.updateContext(mockContext);
    });

    it('should get nested value', async () => {
      const result = await console.executeCommand('get user.name');
      expect(result).toBe('Alice');
    });

    it('should return undefined for missing path', async () => {
      const result = await console.executeCommand('get user.missing');
      expect(result).toContain('undefined');
    });

    it('should set nested value', async () => {
      const result = await console.executeCommand('set user.age 31');

      expect(result).toContain('31');
      expect(console.getContext().current_state).toEqual({
        ...mockContext.current_state,
        user: { ...mockContext.current_state!.user, age: 31 },
      });
    });

    it('should evaluate expressions', async () => {
      const result = await console.executeCommand('eval counter + 8');
      expect(result).toBe(50);
    });

    it('should evaluate complex expressions', async () => {
      const result = await console.executeCommand('eval user.age > 20');
      expect(result).toBe(true);
    });
  });

  describe('Output Callback', () => {
    it('should call output callback', async () => {
      let output = '';
      console.setOutputCallback((msg) => {
        output += msg;
      });

      await console.executeCommand('help');

      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('Export/Import', () => {
    it('should export console state', async () => {
      await console.executeCommand('help');

      const exported = console.exportState();

      expect(exported.history).toBeDefined();
      expect(exported.history.length).toBe(1);
    });

    it('should import console state', () => {
      const state = {
        context: mockContext,
        history: [],
      };

      console.importState(state);

      expect(console.getContext().current_state).toEqual(mockContext.current_state);
    });

    it('should merge imported history', async () => {
      await console.executeCommand('help');

      const exported = console.exportState();
      console.clearHistory();

      console.importState(exported);

      expect(console.getHistory().length).toBe(1);
    });
  });

  describe('Special Commands', () => {
    beforeEach(() => {
      const mockTrace: ExecutionTrace = {
        trace_id: 'trace1',
        graph_id: 'graph1',
        start_time: Date.now(),
        end_time: Date.now() + 1000,
        duration_ms: 1000,
        events: [],
        metrics: {
          total_time_ms: 1000,
          node_times: new Map(),
          nodes_executed: 0,
          edges_traversed: 0,
          error_count: 0,
          warning_count: 0,
          avg_node_time_ms: 0,
        },
        timeline: [],
        state_snapshots: [],
        final_state: {},
        initial_state: {},
        status: 'completed',
        metadata: {},
      };

      mockContext.active_trace = mockTrace;
      console.updateContext(mockContext);
    });

    it('should execute trace command', async () => {
      const result = await console.executeCommand('trace');
      expect(result).toBeDefined();
    });

    it('should execute backtrace command', async () => {
      const result = await console.executeCommand('backtrace');
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only command', async () => {
      const result = await console.executeCommand('   ');
      expect(result).toBeNull();
    });

    it('should handle very long command', async () => {
      const longCmd = 'help ' + 'a'.repeat(10000);
      const result = await console.executeCommand(longCmd);
      expect(result).toBeDefined();
    });

    it('should handle special characters in arguments', async () => {
      console.updateContext(mockContext);
      const result = await console.executeCommand('set user.name "test@#$%"');

      expect(result).toContain('test@#$%');
    });
  });
});
