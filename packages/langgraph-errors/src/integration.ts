/**
 * @file integration.ts - Integration with LangGraph, CoAgents, VL-JEPA, and A2UI
 * @package @lsi/langgraph-errors
 */

import { ErrorHandler } from "./ErrorHandler.js";
import { CircuitBreakerManager } from "./circuit-breaker.js";
import { TimeoutManager } from "./timeout.js";
import type {
  AgentError,
  ErrorPolicy,
  RecoveryResult,
  ErrorContext,
} from "./types.js";

/**
 * LangGraph integration
 */
export class LangGraphIntegration {
  private errorHandler: ErrorHandler;

  constructor(errorHandler: ErrorHandler = new ErrorHandler()) {
    this.errorHandler = errorHandler;
  }

  /**
   * Wrap a LangGraph node with error handling
   */
  wrapNode<NodeInput, NodeOutput>(
    nodeName: string,
    nodeFn: (input: NodeInput) => Promise<NodeOutput>,
    policy?: ErrorPolicy
  ): (input: NodeInput) => Promise<NodeOutput> {
    return async (input: NodeInput): Promise<NodeOutput> => {
      try {
        return await nodeFn(input);
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          nodeName,
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as NodeOutput;
        }

        throw error;
      }
    };
  }

  /**
   * Wrap a LangGraph graph with error handling
   */
  wrapGraph<GraphInput, GraphOutput>(
    graphFn: (input: GraphInput) => Promise<GraphOutput>,
    policy?: ErrorPolicy
  ): (input: GraphInput) => Promise<GraphOutput> {
    return async (input: GraphInput): Promise<GraphOutput> => {
      try {
        return await graphFn(input);
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          "langgraph",
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as GraphOutput;
        }

        throw error;
      }
    };
  }

  /**
   * Create LangGraph error callback
   */
  createErrorCallback(policy?: ErrorPolicy) {
    return async (error: Error, nodeId: string, context?: unknown) => {
      return this.errorHandler.handleError(
        error,
        nodeId,
        context as ErrorContext,
        policy
      );
    };
  }

  /**
   * Wrap StateGraph with error handling
   */
  wrapStateGraph<State>(graph: any, policy?: ErrorPolicy): any {
    // This is a conceptual wrapper for LangGraph StateGraph
    // In a real implementation, this would wrap each node in the graph
    return graph;
  }
}

/**
 * CoAgents integration
 */
export class CoAgentsIntegration {
  private errorHandler: ErrorHandler;

  constructor(errorHandler: ErrorHandler = new ErrorHandler()) {
    this.errorHandler = errorHandler;
  }

  /**
   * Wrap a CoAgent with error handling
   */
  wrapCoAgent<T extends Record<string, unknown>>(
    agentName: string,
    agent: T,
    policy?: ErrorPolicy
  ): T {
    const wrapped = {} as T;

    for (const [key, value] of Object.entries(agent)) {
      if (typeof value === "function") {
        (wrapped as Record<string, unknown>)[key] = async (
          ...args: unknown[]
        ) => {
          try {
            return await (value as Function).apply(agent, args);
          } catch (error) {
            const recoveryResult = await this.errorHandler.handleError(
              error as Error,
              agentName,
              { method: key, args },
              policy
            );

            if (recoveryResult.success && recoveryResult.result) {
              return recoveryResult.result;
            }

            throw error;
          }
        };
      } else {
        (wrapped as Record<string, unknown>)[key] = value;
      }
    }

    return wrapped;
  }

  /**
   * Create error handler for CoAgents orchestrator
   */
  createOrchestratorErrorHandler(policy?: ErrorPolicy) {
    return {
      handleAgentError: async (
        agentName: string,
        error: Error,
        context?: ErrorContext
      ): Promise<RecoveryResult> => {
        return this.errorHandler.handleError(error, agentName, context, policy);
      },

      handleTaskError: async (
        taskName: string,
        error: Error,
        context?: ErrorContext
      ): Promise<RecoveryResult> => {
        return this.errorHandler.handleError(
          error,
          `task_${taskName}`,
          context,
          policy
        );
      },
    };
  }

  /**
   * Wrap CoAgents task runner with error handling
   */
  wrapTaskRunner<TaskInput, TaskOutput>(
    runner: (input: TaskInput) => Promise<TaskOutput>,
    policy?: ErrorPolicy
  ): (input: TaskInput) => Promise<TaskOutput> {
    return async (input: TaskInput): Promise<TaskOutput> => {
      try {
        return await runner(input);
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          "coagents_task",
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as TaskOutput;
        }

        throw error;
      }
    };
  }
}

/**
 * VL-JEPA integration
 */
export class VlJepaIntegration {
  private errorHandler: ErrorHandler;
  private timeoutManager: TimeoutManager;

  constructor(errorHandler: ErrorHandler = new ErrorHandler()) {
    this.errorHandler = errorHandler;
    this.timeoutManager = new TimeoutManager();
  }

  /**
   * Wrap VL-JEPA inference with error handling
   */
  wrapInference<Input, Output>(
    inferenceFn: (input: Input) => Promise<Output>,
    timeoutMs: number = 30000,
    policy?: ErrorPolicy
  ): (input: Input) => Promise<Output> {
    return async (input: Input): Promise<Output> => {
      try {
        return await this.timeoutManager.executeWithTimeout(
          "vljepa_inference",
          () => inferenceFn(input),
          timeoutMs
        );
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          "vljepa_inference",
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as Output;
        }

        throw error;
      }
    };
  }

  /**
   * Wrap VL-JEPA training with error handling
   */
  wrapTraining<TrainingInput, TrainingOutput>(
    trainingFn: (input: TrainingInput) => Promise<TrainingOutput>,
    policy?: ErrorPolicy
  ): (input: TrainingInput) => Promise<TrainingOutput> {
    return async (input: TrainingInput): Promise<TrainingOutput> => {
      try {
        return await trainingFn(input);
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          "vljepa_training",
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as TrainingOutput;
        }

        throw error;
      }
    };
  }

  /**
   * Wrap multimodal processing with error handling
   */
  wrapMultimodal<Input, Output>(
    processFn: (input: Input) => Promise<Output>,
    policy?: ErrorPolicy
  ): (input: Input) => Promise<Output> {
    return async (input: Input): Promise<Output> => {
      try {
        return await processFn(input);
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          "vljepa_multimodal",
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as Output;
        }

        throw error;
      }
    };
  }
}

/**
 * A2UI integration
 */
export class A2UIIntegration {
  private errorHandler: ErrorHandler;

  constructor(errorHandler: ErrorHandler = new ErrorHandler()) {
    this.errorHandler = errorHandler;
  }

  /**
   * Wrap A2UI action with error handling
   */
  wrapAction<ActionInput, ActionOutput>(
    actionName: string,
    actionFn: (input: ActionInput) => Promise<ActionOutput>,
    policy?: ErrorPolicy
  ): (input: ActionInput) => Promise<ActionOutput> {
    return async (input: ActionInput): Promise<ActionOutput> => {
      try {
        return await actionFn(input);
      } catch (error) {
        const recoveryResult = await this.errorHandler.handleError(
          error as Error,
          `a2ui_action_${actionName}`,
          { input },
          policy
        );

        if (recoveryResult.success && recoveryResult.result) {
          return recoveryResult.result as ActionOutput;
        }

        throw error;
      }
    };
  }

  /**
   * Create user-friendly error response
   */
  createErrorResponse(error: AgentError): {
    message: string;
    severity: string;
    suggestion?: string;
    canRetry: boolean;
  } {
    const suggestions: Record<string, string> = {
      timeout: "The operation took too long. Please try again.",
      network: "Network issue detected. Please check your connection.",
      validation: "Invalid input. Please check your data and try again.",
      authentication: "Authentication failed. Please log in again.",
      authorization: "You do not have permission to perform this action.",
      rate_limit: "Too many requests. Please wait a moment and try again.",
      resource: "System resources are unavailable. Please try again later.",
    };

    return {
      message: error.message,
      severity: error.severity,
      suggestion:
        suggestions[error.category] || "An error occurred. Please try again.",
      canRetry: error.retryable,
    };
  }

  /**
   * Wrap A2UI component with error boundary behavior
   */
  wrapComponent<ComponentProps>(
    componentFn: (props: ComponentProps) => Promise<unknown>,
    fallbackUI?: (error: AgentError) => unknown,
    policy?: ErrorPolicy
  ): (props: ComponentProps) => Promise<unknown> {
    return async (props: ComponentProps): Promise<unknown> => {
      try {
        return await componentFn(props);
      } catch (error) {
        const agentError = await this.errorHandler.handleError(
          error as Error,
          "a2ui_component",
          { props },
          policy
        );

        if (fallbackUI && agentError.error) {
          return fallbackUI(agentError.error);
        }

        throw error;
      }
    };
  }

  /**
   * Create form validation error handler
   */
  createFormValidationHandler() {
    return {
      handleValidationErrors: async (
        errors: Array<{ field: string; message: string }>
      ): Promise<{ valid: boolean; errors: typeof errors }> => {
        return {
          valid: false,
          errors,
        };
      },
    };
  }
}

/**
 * Universal integration helper
 */
export class ErrorHandlingIntegration {
  private langGraph: LangGraphIntegration;
  private coAgents: CoAgentsIntegration;
  private vlJepa: VlJepaIntegration;
  private a2ui: A2UIIntegration;

  constructor(errorHandler?: ErrorHandler) {
    const handler = errorHandler || new ErrorHandler();
    this.langGraph = new LangGraphIntegration(handler);
    this.coAgents = new CoAgentsIntegration(handler);
    this.vlJepa = new VlJepaIntegration(handler);
    this.a2ui = new A2UIIntegration(handler);
  }

  /**
   * Get LangGraph integration
   */
  langgraph(): LangGraphIntegration {
    return this.langGraph;
  }

  /**
   * Get CoAgents integration
   */
  coagents(): CoAgentsIntegration {
    return this.coAgents;
  }

  /**
   * Get VL-JEPA integration
   */
  vljepa(): VlJepaIntegration {
    return this.vlJepa;
  }

  /**
   * Get A2UI integration
   */
  a2ui(): A2UIIntegration {
    return this.a2ui;
  }

  /**
   * Create unified error policy
   */
  createPolicy(overrides?: Partial<ErrorPolicy>): ErrorPolicy {
    return {
      max_retries: 3,
      timeout: 30000,
      retryable: true,
      recovery_strategy: "retry",
      use_circuit_breaker: true,
      circuit_breaker_threshold: 5,
      circuit_breaker_reset_timeout: 60000,
      ...overrides,
    };
  }
}

/**
 * Singleton instance
 */
export const errorHandlingIntegration = new ErrorHandlingIntegration();

/**
 * Convenience functions for quick integration
 */
export function wrapLangGraphNode<NodeInput, NodeOutput>(
  nodeName: string,
  nodeFn: (input: NodeInput) => Promise<NodeOutput>,
  policy?: ErrorPolicy
): (input: NodeInput) => Promise<NodeOutput> {
  return errorHandlingIntegration
    .langgraph()
    .wrapNode(nodeName, nodeFn, policy);
}

export function wrapCoAgent<T extends Record<string, unknown>>(
  agentName: string,
  agent: T,
  policy?: ErrorPolicy
): T {
  return errorHandlingIntegration
    .coagents()
    .wrapCoAgent(agentName, agent, policy);
}

export function wrapVlJepaInference<Input, Output>(
  inferenceFn: (input: Input) => Promise<Output>,
  timeoutMs?: number,
  policy?: ErrorPolicy
): (input: Input) => Promise<Output> {
  return errorHandlingIntegration
    .vljepa()
    .wrapInference(inferenceFn, timeoutMs, policy);
}

export function wrapA2UIAction<ActionInput, ActionOutput>(
  actionName: string,
  actionFn: (input: ActionInput) => Promise<ActionOutput>,
  policy?: ErrorPolicy
): (input: ActionInput) => Promise<ActionOutput> {
  return errorHandlingIntegration
    .a2ui()
    .wrapAction(actionName, actionFn, policy);
}
