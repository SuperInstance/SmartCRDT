/**
 * @file timeout.ts - Timeout management and enforcement
 * @package @lsi/langgraph-errors
 */

import type { TimeoutConfig, AgentError } from "./types.js";

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Timeout manager
 */
export class TimeoutManager {
  private config: TimeoutConfig;
  private activeTimeouts: Map<string, NodeJS.Timeout>;

  constructor(config?: Partial<TimeoutConfig>) {
    this.config = {
      global_timeout: config?.global_timeout ?? 30000,
      agent_timeouts: config?.agent_timeouts ?? {},
      escalate_on_timeout: config?.escalate_on_timeout ?? false,
      escalation_timeout: config?.escalation_timeout ?? 60000,
    };
    this.activeTimeouts = new Map();
  }

  /**
   * Execute operation with timeout
   */
  async executeWithTimeout<T>(
    agentId: string,
    operation: () => Promise<T>,
    customTimeout?: number
  ): Promise<T> {
    const timeout = this.getTimeoutForAgent(agentId, customTimeout);
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new TimeoutError(
            `Operation timed out after ${timeout}ms for agent: ${agentId}`,
            agentId,
            timeout
          )
        );
      }, timeout);
    });

    if (timeoutHandle) {
      this.activeTimeouts.set(`${agentId}_${Date.now()}`, timeoutHandle);
    }

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Execute with global timeout
   */
  async executeWithGlobalTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number
  ): Promise<T> {
    const timeout = customTimeout ?? this.config.global_timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(
            `Operation timed out after ${timeout}ms`,
            "global",
            timeout
          )
        );
      }, timeout);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Execute with escalation on timeout
   */
  async executeWithEscalation<T>(
    agentId: string,
    operation: () => Promise<T>,
    escalationHandler?: () => Promise<T>,
    customTimeout?: number
  ): Promise<T> {
    const initialTimeout = this.getTimeoutForAgent(agentId, customTimeout);

    try {
      return await this.executeWithTimeout(agentId, operation, initialTimeout);
    } catch (error) {
      if (
        error instanceof TimeoutError &&
        this.config.escalate_on_timeout &&
        escalationHandler
      ) {
        console.log(`Timeout for agent ${agentId}, escalating to handler...`);
        return this.executeWithTimeout(
          `${agentId}_escalated`,
          escalationHandler,
          this.config.escalation_timeout
        );
      }
      throw error;
    }
  }

  /**
   * Execute multiple operations with individual timeouts
   */
  async executeAllWithTimeouts<T>(
    operations: Array<{
      agentId: string;
      operation: () => Promise<T>;
      timeout?: number;
    }>
  ): Promise<Array<{ agentId: string; result?: T; error?: Error }>> {
    const results = await Promise.allSettled(
      operations.map(({ agentId, operation, timeout }) =>
        this.executeWithTimeout(agentId, operation, timeout)
      )
    );

    return operations.map(({ agentId }, index) => {
      const result = results[index];
      if (result.status === "fulfilled") {
        return { agentId, result: result.value };
      } else {
        return { agentId, error: result.reason };
      }
    });
  }

  /**
   * Race multiple operations with individual timeouts
   */
  async raceWithTimeouts<T>(
    operations: Array<{
      agentId: string;
      operation: () => Promise<T>;
      timeout?: number;
    }>
  ): Promise<{ agentId: string; result: T }> {
    const promises = operations.map(({ agentId, operation, timeout }) =>
      this.executeWithTimeout(agentId, operation, timeout).then(result => ({
        agentId,
        result,
      }))
    );

    return Promise.race(promises);
  }

  /**
   * Get timeout for a specific agent
   */
  private getTimeoutForAgent(agentId: string, customTimeout?: number): number {
    if (customTimeout !== undefined) {
      return customTimeout;
    }
    return this.config.agent_timeouts[agentId] ?? this.config.global_timeout;
  }

  /**
   * Set timeout for an agent
   */
  setTimeoutForAgent(agentId: string, timeout: number): void {
    this.config.agent_timeouts[agentId] = timeout;
  }

  /**
   * Set global timeout
   */
  setGlobalTimeout(timeout: number): void {
    this.config.global_timeout = timeout;
  }

  /**
   * Set escalation timeout
   */
  setEscalationTimeout(timeout: number): void {
    this.config.escalation_timeout = timeout;
  }

  /**
   * Enable/disable escalation on timeout
   */
  setEscalationOnTimeout(enabled: boolean): void {
    this.config.escalate_on_timeout = enabled;
  }

  /**
   * Clear all active timeouts
   */
  clearTimeouts(): void {
    for (const timeoutHandle of this.activeTimeouts.values()) {
      clearTimeout(timeoutHandle);
    }
    this.activeTimeouts.clear();
  }

  /**
   * Get timeout statistics
   */
  getStatistics(): {
    globalTimeout: number;
    agentTimeouts: Record<string, number>;
    activeTimeouts: number;
    escalateOnTimeout: boolean;
    escalationTimeout: number;
  } {
    return {
      globalTimeout: this.config.global_timeout,
      agentTimeouts: { ...this.config.agent_timeouts },
      activeTimeouts: this.activeTimeouts.size,
      escalateOnTimeout: this.config.escalate_on_timeout,
      escalationTimeout: this.config.escalation_timeout,
    };
  }

  /**
   * Reset configuration
   */
  reset(): void {
    this.clearTimeouts();
    this.config = {
      global_timeout: 30000,
      agent_timeouts: {},
      escalate_on_timeout: false,
      escalation_timeout: 60000,
    };
  }

  /**
   * Create timeout promise
   */
  static createTimeoutPromise<T>(
    timeoutMs: number,
    errorMessage: string = `Operation timed out after ${timeoutMs}ms`
  ): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
  }

  /**
   * Wrap function with timeout
   */
  static withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      TimeoutManager.createTimeoutPromise<T>(timeoutMs, errorMessage),
    ]);
  }
}

/**
 * Singleton instance
 */
export const timeoutManager = new TimeoutManager();

/**
 * Convenience function to execute with timeout
 */
export async function withTimeout<T>(
  agentId: string,
  operation: () => Promise<T>,
  timeout?: number
): Promise<T> {
  return timeoutManager.executeWithTimeout(agentId, operation, timeout);
}

/**
 * Convenience function to execute with global timeout
 */
export async function withGlobalTimeout<T>(
  operation: () => Promise<T>,
  timeout?: number
): Promise<T> {
  return timeoutManager.executeWithGlobalTimeout(operation, timeout);
}

/**
 * Convenience function to create a timeout decorator
 */
export function Timeout(timeoutMs: number) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return TimeoutManager.withTimeout(
        () => originalMethod.apply(this, args),
        timeoutMs,
        `Method ${propertyKey} timed out after ${timeoutMs}ms`
      );
    };

    return descriptor;
  };
}
