/**
 * @file integration.test.ts - Tests for integration modules
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LangGraphIntegration,
  CoAgentsIntegration,
  VlJepaIntegration,
  A2UIIntegration,
  ErrorHandlingIntegration,
} from '../src/integration.js';
import { ErrorHandler } from '../src/ErrorHandler.js';
import type { ErrorPolicy, AgentError } from '../src/types.js';

describe('LangGraphIntegration', () => {
  let integration: LangGraphIntegration;
  let mockErrorHandler: ErrorHandler;

  beforeEach(() => {
    mockErrorHandler = {
      handleError: vi.fn().mockResolvedValue({
        success: true,
        strategy: 'retry',
        result: 'recovered',
        recovery_time: 100,
        attempts: 1,
      }),
    } as unknown as ErrorHandler;
    integration = new LangGraphIntegration(mockErrorHandler as ErrorHandler);
  });

  describe('wrapNode', () => {
    it('should wrap node with error handling', async () => {
      const nodeFn = vi.fn().mockResolvedValue('result');
      const wrappedNode = integration.wrapNode('test-node', nodeFn);

      const result = await wrappedNode({ input: 'data' });

      expect(result).toBe('result');
      expect(nodeFn).toHaveBeenCalledWith({ input: 'data' });
    });

    it('should handle errors and recover', async () => {
      const nodeFn = vi.fn().mockRejectedValue(new Error('Node failed'));
      const wrappedNode = integration.wrapNode('test-node', nodeFn);

      const result = await wrappedNode({ input: 'data' });

      expect(mockErrorHandler.handleError).toHaveBeenCalled();
      expect(result).toBe('recovered');
    });

    it('should use custom policy', async () => {
      const nodeFn = vi.fn().mockRejectedValue(new Error('Node failed'));
      const policy: ErrorPolicy = {
        max_retries: 5,
        timeout: 60000,
       
        recovery_strategy: 'retry',
      };

      const wrappedNode = integration.wrapNode('test-node', nodeFn, policy);
      await wrappedNode({ input: 'data' });

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'test-node',
        { input: 'data' },
        policy
      );
    });
  });

  describe('wrapGraph', () => {
    it('should wrap graph with error handling', async () => {
      const graphFn = vi.fn().mockResolvedValue('graph-result');
      const wrappedGraph = integration.wrapGraph(graphFn);

      const result = await wrappedGraph({ input: 'data' });

      expect(result).toBe('graph-result');
    });
  });

  describe('createErrorCallback', () => {
    it('should create error callback', async () => {
      const callback = integration.createErrorCallback();

      const result = await callback(new Error('Test'), 'node-1', { context: 'data' });

      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });
});

describe('CoAgentsIntegration', () => {
  let integration: CoAgentsIntegration;
  let mockErrorHandler: ErrorHandler;

  beforeEach(() => {
    mockErrorHandler = {
      handleError: vi.fn().mockResolvedValue({
        success: true,
        strategy: 'fallback',
        result: 'fallback-result',
        recovery_time: 100,
        attempts: 1,
      }),
    } as unknown as ErrorHandler;
    integration = new CoAgentsIntegration(mockErrorHandler as ErrorHandler);
  });

  describe('wrapCoAgent', () => {
    it('should wrap agent methods with error handling', async () => {
      const agent = {
        method1: vi.fn().mockResolvedValue('result1'),
        method2: vi.fn().mockResolvedValue('result2'),
        property: 'value',
      };

      const wrappedAgent = integration.wrapCoAgent('agent-1', agent);

      expect(await wrappedAgent.method1()).toBe('result1');
      expect(await wrappedAgent.method2()).toBe('result2');
      expect(wrappedAgent.property).toBe('value');
    });

    it('should handle method errors', async () => {
      const agent = {
        method: vi.fn().mockRejectedValue(new Error('Method failed')),
      };

      const wrappedAgent = integration.wrapCoAgent('agent-1', agent);

      const result = await wrappedAgent.method();

      expect(result).toBe('fallback-result');
    });
  });

  describe('createOrchestratorErrorHandler', () => {
    it('should create orchestrator error handler', async () => {
      const handler = integration.createOrchestratorErrorHandler();

      const result = await handler.handleAgentError(
        'agent-1',
        new Error('Agent failed')
      );

      expect(result).toBeDefined();
    });

    it('should handle task errors', async () => {
      const handler = integration.createOrchestratorErrorHandler();

      const result = await handler.handleTaskError(
        'task-1',
        new Error('Task failed')
      );

      expect(result).toBeDefined();
    });
  });

  describe('wrapTaskRunner', () => {
    it('should wrap task runner', async () => {
      const runner = vi.fn().mockResolvedValue('task-result');
      const wrappedRunner = integration.wrapTaskRunner(runner);

      const result = await wrappedRunner({ task: 'data' });

      expect(result).toBe('task-result');
    });
  });
});

describe('VlJepaIntegration', () => {
  let integration: VlJepaIntegration;
  let mockErrorHandler: ErrorHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockErrorHandler = {
      handleError: vi.fn().mockResolvedValue({
        success: true,
        strategy: 'retry',
        result: 'inference-result',
        recovery_time: 100,
        attempts: 1,
      }),
    } as unknown as ErrorHandler;
    integration = new VlJepaIntegration(mockErrorHandler as ErrorHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('wrapInference', () => {
    it('should wrap inference with timeout', async () => {
      const inferenceFn = vi.fn().mockResolvedValue('output');
      const wrapped = integration.wrapInference(inferenceFn, 1000);

      const promise = wrapped({ input: 'data' });
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toBe('output');
    });

    it('should timeout slow inference', async () => {
      const inferenceFn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('output'), 2000))
      );
      const wrapped = integration.wrapInference(inferenceFn, 1000);

      const promise = wrapped({ input: 'data' });
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow();
    });
  });

  describe('wrapTraining', () => {
    it('should wrap training with error handling', async () => {
      const trainingFn = vi.fn().mockResolvedValue('trained');
      const wrapped = integration.wrapTraining(trainingFn);

      const result = await wrapped({ epochs: 10 });

      expect(result).toBe('trained');
    });
  });

  describe('wrapMultimodal', () => {
    it('should wrap multimodal processing', async () => {
      const processFn = vi.fn().mockResolvedValue('processed');
      const wrapped = integration.wrapMultimodal(processFn);

      const result = await wrapped({ text: 'test', image: 'data' });

      expect(result).toBe('processed');
    });
  });
});

describe('A2UIIntegration', () => {
  let integration: A2UIIntegration;
  let mockErrorHandler: ErrorHandler;

  beforeEach(() => {
    mockErrorHandler = {
      handleError: vi.fn().mockResolvedValue({
        success: true,
        strategy: 'fallback',
        result: 'action-result',
        recovery_time: 100,
        attempts: 1,
      }),
    } as unknown as ErrorHandler;
    integration = new A2UIIntegration(mockErrorHandler as ErrorHandler);
  });

  describe('wrapAction', () => {
    it('should wrap action with error handling', async () => {
      const actionFn = vi.fn().mockResolvedValue('action-result');
      const wrapped = integration.wrapAction('click', actionFn);

      const result = await wrapped({ element: 'button' });

      expect(result).toBe('action-result');
    });

    it('should handle action errors', async () => {
      const actionFn = vi.fn().mockRejectedValue(new Error('Click failed'));
      const wrapped = integration.wrapAction('click', actionFn);

      const result = await wrapped({ element: 'button' });

      expect(result).toBe('action-result');
    });
  });

  describe('createErrorResponse', () => {
    it('should create user-friendly error response', () => {
      const error: AgentError = {
        error_id: 'err_1',
        agent_id: 'a2ui',
        severity: 'error',
        category: 'timeout',
        message: 'Action timed out',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      };

      const response = integration.createErrorResponse(error);

      expect(response.message).toBe('Action timed out');
      expect(response.severity).toBe('error');
      expect(response.suggestion).toBeDefined();
      expect(response.canRetry).toBe(true);
    });

    it('should provide suggestions by category', () => {
      const timeoutError: AgentError = {
        error_id: 'err_1',
        agent_id: 'a2ui',
        severity: 'error',
        category: 'timeout',
        message: 'Timeout',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      };

      const networkError: AgentError = {
        ...timeoutError,
        category: 'network',
        message: 'Network error',
      };

      const timeoutResponse = integration.createErrorResponse(timeoutError);
      const networkResponse = integration.createErrorResponse(networkError);

      expect(timeoutResponse.suggestion).toContain('try again');
      expect(networkResponse.suggestion).toContain('connection');
    });
  });

  describe('wrapComponent', () => {
    it('should wrap component with error boundary', async () => {
      const componentFn = vi.fn().mockResolvedValue('rendered');
      const wrapped = integration.wrapComponent(componentFn);

      const result = await wrapped({ props: 'data' });

      expect(result).toBe('rendered');
    });

    it('should use fallback UI on error', async () => {
      const componentFn = vi.fn().mockRejectedValue(new Error('Render failed'));
      const fallbackUI = vi.fn().mockReturnValue('error-message');
      const wrapped = integration.wrapComponent(componentFn, fallbackUI);

      const result = await wrapped({ props: 'data' });

      expect(result).toBe('error-message');
      expect(fallbackUI).toHaveBeenCalled();
    });
  });

  describe('createFormValidationHandler', () => {
    it('should create form validation handler', () => {
      const handler = integration.createFormValidationHandler();

      expect(handler.handleValidationErrors).toBeDefined();
    });
  });
});

describe('ErrorHandlingIntegration', () => {
  let integration: ErrorHandlingIntegration;

  beforeEach(() => {
    integration = new ErrorHandlingIntegration();
  });

  describe('getters', () => {
    it('should provide LangGraph integration', () => {
      expect(integration.langgraph()).toBeInstanceOf(LangGraphIntegration);
    });

    it('should provide CoAgents integration', () => {
      expect(integration.coagents()).toBeInstanceOf(CoAgentsIntegration);
    });

    it('should provide VL-JEPA integration', () => {
      expect(integration.vljepa()).toBeInstanceOf(VlJepaIntegration);
    });

    it('should provide A2UI integration', () => {
      expect(integration.a2ui()).toBeInstanceOf(A2UIIntegration);
    });
  });

  describe('createPolicy', () => {
    it('should create default policy', () => {
      const policy = integration.createPolicy();

      expect(policy.max_retries).toBeDefined();
      expect(policy.timeout).toBeDefined();
      expect(policy.retryable).toBeDefined();
    });

    it('should apply overrides', () => {
      const policy = integration.createPolicy({
        max_retries: 10,
        timeout: 60000,
      });

      expect(policy.max_retries).toBe(10);
      expect(policy.timeout).toBe(60000);
    });
  });
});
