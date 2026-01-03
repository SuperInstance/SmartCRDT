/**
 * @module privacy/vm
 *
 * Sandboxed Cartridge Executor - Manages cartridge lifecycle in WASM sandboxes.
 *
 * This module provides high-level lifecycle management for cartridges executing
 * in secure WebAssembly sandboxes. It handles:
 * - Cartridge loading and initialization
 * - Request execution with error handling
 * - State management and monitoring
 * - Timeout and resource exhaustion recovery
 *
 * The executor provides a clean API for the rest of the system to interact
 * with sandboxed cartridges without worrying about VM internals.
 */

import type { CartridgeManifest } from "@lsi/protocol";
import type { VMError } from "./SecureVM.js";
import { WASMSandboxEnhanced } from "./WASMSandboxEnhanced.js";
import {
  CartridgeVMBridge,
  SandboxedCartridge,
  ResourceQuota,
  CartridgeResult,
} from "./CartridgeVMBridge.js";
import { VMErrorCode } from "./SecureVM.js";

/**
 * Cartridge execution request
 *
 * Request to execute a cartridge method with parameters.
 */
export interface CartridgeRequest {
  /** Method name to execute */
  method: string;

  /** Method parameters */
  params: unknown[];

  /** Optional request ID for tracking */
  request_id?: string;

  /** Optional timeout override (milliseconds) */
  timeout?: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cartridge execution response
 *
 * Response from cartridge execution.
 */
export interface CartridgeResponse {
  /** Request ID (if provided) */
  request_id?: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Result data if successful */
  data?: unknown;

  /** Error details if failed */
  error?: CartridgeExecutionError;

  /** Execution time in milliseconds */
  execution_time: number;

  /** Resource usage during execution */
  resource_usage: {
    /** Memory used in bytes */
    memory_bytes: number;
    /** CPU used as percentage */
    cpu_percent: number;
  };
}

/**
 * Cartridge execution error
 */
export interface CartridgeExecutionError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Whether error is recoverable */
  recoverable: boolean;

  /** Suggested recovery action */
  recovery?: RecoveryAction;

  /** Stack trace if available */
  stack?: string;
}

/**
 * Recovery action for errors
 */
export type RecoveryAction =
  | "retry" /** Retry the execution */
  | "reinitialize" /** Reinitialize the cartridge */
  | "reload" /** Reload the cartridge from scratch */
  | "abort" /** Abort the execution */
  | "ignore" /** Ignore the error and continue */;

/**
 * Cartridge state information
 */
export interface CartridgeInfo {
  /** Cartridge instance ID */
  id: string;

  /** Cartridge manifest */
  manifest: CartridgeManifest;

  /** Current state */
  state: CartridgeInstanceState;

  /** Load timestamp */
  loaded_at: number;

  /** Last execution timestamp */
  last_executed_at?: number;

  /** Execution statistics */
  stats: {
    /** Total executions */
    total: number;
    /** Successful executions */
    successful: number;
    /** Failed executions */
    failed: number;
    /** Total execution time in milliseconds */
    total_time: number;
    /** Average execution time in milliseconds */
    average_time: number;
  };

  /** Current resource quota */
  quota: ResourceQuota;
}

/**
 * Cartridge instance state
 */
export type CartridgeInstanceState =
  | "unloaded" /** Cartridge is not loaded */
  | "loading" /** Cartridge is being loaded */
  | "loaded" /** Cartridge is loaded and ready */
  | "running" /** Cartridge is executing a request */
  | "paused" /** Cartridge is paused */
  | "error" /** Cartridge is in error state */
  | "unloading" /** Cartridge is being unloaded */;

/**
 * Error resolution result
 */
export interface ErrorResolution {
  /** Whether resolution was successful */
  success: boolean;

  /** Action taken */
  action: RecoveryAction;

  /** Resolution message */
  message: string;

  /** New cartridge state */
  new_state: CartridgeInstanceState;
}

/**
 * Recovery result from timeout
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;

  /** Recovery method used */
  method: RecoveryAction;

  /** Time to recover in milliseconds */
  recovery_time: number;

  /** Whether cartridge state was restored */
  state_restored: boolean;
}

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  /** Default execution timeout in milliseconds */
  default_timeout: number;

  /** Maximum execution timeout in milliseconds */
  max_timeout: number;

  /** Maximum retry attempts for recoverable errors */
  max_retries: number;

  /** Retry delay in milliseconds */
  retry_delay: number;

  /** Whether to enable automatic recovery */
  auto_recovery: boolean;

  /** Whether to log all executions */
  log_executions: boolean;

  /** Maximum concurrent executions */
  max_concurrent: number;
}

/**
 * Default executor configuration
 */
export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  default_timeout: 5000, // 5 seconds
  max_timeout: 30000, // 30 seconds
  max_retries: 3,
  retry_delay: 1000, // 1 second
  auto_recovery: true,
  log_executions: false,
  max_concurrent: 10,
};

/**
 * Sandboxed Cartridge Executor
 *
 * Manages the lifecycle of cartridges in WASM sandboxes.
 * Provides high-level API for cartridge execution.
 */
export class SandboxedCartridgeExecutor {
  private bridge: CartridgeVMBridge;
  private config: ExecutorConfig;
  private cartridges = new Map<string, CartridgeInternalState>();
  private activeExecutions: number = 0;
  private executionQueue: Array<{
    cartridgeId: string;
    request: CartridgeRequest;
    resolve: (response: CartridgeResponse) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    sandbox: WASMSandboxEnhanced,
    bridge?: CartridgeVMBridge,
    config?: Partial<ExecutorConfig>
  ) {
    this.bridge = bridge || new CartridgeVMBridge();
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  /**
   * Load a cartridge into a sandbox
   *
   * @param manifest - Cartridge manifest
   * @param wasmModule - WebAssembly module binary
   * @param signature - Optional code signature
   * @returns Cartridge instance ID
   */
  async load(
    manifest: CartridgeManifest,
    wasmModule: ArrayBuffer,
    signature?: string
  ): Promise<string> {
    const cartridgeId = `${manifest.id}@${manifest.version}`;

    // Check if already loaded
    if (this.cartridges.has(cartridgeId)) {
      throw new Error(`Cartridge ${cartridgeId} is already loaded`);
    }

    // Create internal state
    const state: CartridgeInternalState = {
      id: cartridgeId,
      manifest,
      state: "loading",
      loadedAt: Date.now(),
      stats: {
        total: 0,
        successful: 0,
        failed: 0,
        totalTime: 0,
      },
    };

    this.cartridges.set(cartridgeId, state);

    try {
      // Load into bridge
      const sandboxed = await this.bridge.load_cartridge(manifest, wasmModule);

      // Update state
      state.sandboxed = sandboxed;
      state.state = "loaded";

      return cartridgeId;
    } catch (error) {
      // Clean up on failure
      this.cartridges.delete(cartridgeId);
      state.state = "error";
      throw error;
    }
  }

  /**
   * Initialize a loaded cartridge
   *
   * Calls the cartridge's init function if present.
   *
   * @param cartridgeId - Cartridge instance ID
   */
  async initialize(cartridgeId: string): Promise<void> {
    const state = this.cartridges.get(cartridgeId);
    if (!state) {
      throw new Error(`Cartridge ${cartridgeId} not found`);
    }

    if (state.state !== "loaded") {
      throw new Error(`Cannot initialize cartridge in state ${state.state}`);
    }

    state.state = "running";

    try {
      // Try to call init function
      const result = await this.bridge.execute_method(cartridgeId, "init", []);

      if (!result.success) {
        // Init function might not exist, that's okay
        if (result.error?.code !== "FUNCTION_NOT_FOUND") {
          throw new Error(`Init failed: ${result.error?.message}`);
        }
      }

      state.state = "loaded";
    } catch (error) {
      state.state = "error";
      throw error;
    }
  }

  /**
   * Execute a cartridge method
   *
   * @param cartridgeId - Cartridge instance ID
   * @param request - Execution request
   * @returns Execution response
   */
  async execute(
    cartridgeId: string,
    request: CartridgeRequest
  ): Promise<CartridgeResponse> {
    const state = this.cartridges.get(cartridgeId);
    if (!state) {
      return {
        request_id: request.request_id,
        success: false,
        error: {
          code: "CARTRIDGE_NOT_FOUND",
          message: `Cartridge ${cartridgeId} not found`,
          recoverable: false,
          recovery: "abort",
        },
        execution_time: 0,
        resource_usage: { memory_bytes: 0, cpu_percent: 0 },
      };
    }

    // Check state
    if (state.state === "unloaded" || state.state === "error") {
      return {
        request_id: request.request_id,
        success: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot execute cartridge in state ${state.state}`,
          recoverable: false,
          recovery: state.state === "error" ? "reload" : "abort",
        },
        execution_time: 0,
        resource_usage: { memory_bytes: 0, cpu_percent: 0 },
      };
    }

    // Check concurrent execution limit
    if (this.activeExecutions >= this.config.max_concurrent) {
      // Queue the request
      return new Promise((resolve, reject) => {
        this.executionQueue.push({
          cartridgeId,
          request,
          resolve,
          reject,
        });
      });
    }

    // Execute with retry logic
    return this.executeWithRetry(cartridgeId, request, 0);
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    cartridgeId: string,
    request: CartridgeRequest,
    attempt: number
  ): Promise<CartridgeResponse> {
    const state = this.cartridges.get(cartridgeId)!;
    const startTime = Date.now();

    this.activeExecutions++;
    state.state = "running";

    try {
      // Execute method
      const result = await this.bridge.execute_method(
        cartridgeId,
        request.method,
        request.params
      );

      const executionTime = Date.now() - startTime;

      // Update stats
      state.stats.total++;
      state.stats.totalTime += executionTime;
      state.lastExecutedAt = Date.now();

      if (!result.success) {
        state.stats.failed++;

        const error = this.convertError(result.error);

        // Check if we should retry
        if (
          error.recoverable &&
          attempt < this.config.max_retries &&
          this.config.auto_recovery
        ) {
          if (this.config.log_executions) {
            console.log(
              `Retry ${attempt + 1}/${this.config.max_retries} for ${cartridgeId}`
            );
          }

          await new Promise(resolve =>
            setTimeout(resolve, this.config.retry_delay)
          );
          this.activeExecutions--;

          return this.executeWithRetry(cartridgeId, request, attempt + 1);
        }

        state.state = "error";
        return {
          request_id: request.request_id,
          success: false,
          error,
          execution_time: executionTime,
          resource_usage: {
            memory_bytes: result.memoryUsed,
            cpu_percent: result.cpuUsed,
          },
        };
      }

      state.stats.successful++;
      state.state = "loaded";

      return {
        request_id: request.request_id,
        success: true,
        data: result.data,
        execution_time: executionTime,
        resource_usage: {
          memory_bytes: result.memoryUsed,
          cpu_percent: result.cpuUsed,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      state.stats.failed++;
      state.state = "error";

      return {
        request_id: request.request_id,
        success: false,
        error: {
          code: "RUNTIME_EXCEPTION",
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
          recovery: "reinitialize",
          stack: error instanceof Error ? error.stack : undefined,
        },
        execution_time: executionTime,
        resource_usage: { memory_bytes: 0, cpu_percent: 0 },
      };
    } finally {
      this.activeExecutions--;

      // Process queued executions
      if (
        this.executionQueue.length > 0 &&
        this.activeExecutions < this.config.max_concurrent
      ) {
        const next = this.executionQueue.shift();
        if (next) {
          setImmediate(() => {
            this.execute(next.cartridgeId, next.request)
              .then(next.resolve)
              .catch(next.reject);
          });
        }
      }
    }
  }

  /**
   * Shutdown a cartridge
   *
   * @param cartridgeId - Cartridge instance ID
   */
  async shutdown(cartridgeId: string): Promise<void> {
    const state = this.cartridges.get(cartridgeId);
    if (!state) {
      return; // Already shutdown
    }

    state.state = "unloading";

    try {
      // Try to call shutdown function
      await this.bridge.execute_method(cartridgeId, "shutdown", []);
    } catch {
      // Ignore shutdown errors
    }

    // Unload from bridge
    await this.bridge.unload_cartridge(cartridgeId);

    // Remove state
    this.cartridges.delete(cartridgeId);
  }

  /**
   * Get cartridge state
   *
   * @param cartridgeId - Cartridge instance ID
   * @returns Cartridge state
   */
  get_state(cartridgeId: string): CartridgeInstanceState {
    const state = this.cartridges.get(cartridgeId);
    return state?.state ?? "unloaded";
  }

  /**
   * List all cartridges
   *
   * @returns Array of cartridge info
   */
  list_cartridges(): CartridgeInfo[] {
    return Array.from(this.cartridges.values()).map(state =>
      this.buildCartridgeInfo(state)
    );
  }

  /**
   * Handle sandbox error
   *
   * @param error - Sandbox error
   * @returns Error resolution
   */
  handle_sandbox_error(error: VMError): ErrorResolution {
    const recoverable = this.isRecoverableError(error.code);
    const recovery = this.suggestRecovery(error.code);

    return {
      success: recoverable,
      action: recovery,
      message: error.message,
      new_state: recoverable ? "loaded" : "error",
    };
  }

  /**
   * Recover from timeout
   *
   * @param cartridgeId - Cartridge instance ID
   * @returns Recovery result
   */
  async recover_from_timeout(cartridgeId: string): Promise<RecoveryResult> {
    const startTime = Date.now();
    const state = this.cartridges.get(cartridgeId);

    if (!state) {
      return {
        success: false,
        method: "abort",
        recovery_time: 0,
        state_restored: false,
      };
    }

    try {
      // Try to pause and resume
      await state.sandboxed?.sandbox.pause();
      await state.sandboxed?.sandbox.resume();

      state.state = "loaded";

      return {
        success: true,
        method: "reinitialize",
        recovery_time: Date.now() - startTime,
        state_restored: true,
      };
    } catch {
      // Pause/resume failed, try reload
      try {
        const manifest = state.manifest;
        // Note: We would need the original wasmModule here
        // For now, mark as error
        state.state = "error";

        return {
          success: false,
          method: "reload",
          recovery_time: Date.now() - startTime,
          state_restored: false,
        };
      } catch {
        return {
          success: false,
          method: "abort",
          recovery_time: Date.now() - startTime,
          state_restored: false,
        };
      }
    }
  }

  /**
   * Build cartridge info from internal state
   */
  private buildCartridgeInfo(state: CartridgeInternalState): CartridgeInfo {
    const avgTime =
      state.stats.total > 0 ? state.stats.totalTime / state.stats.total : 0;

    return {
      id: state.id,
      manifest: state.manifest,
      state: state.state,
      loaded_at: state.loadedAt,
      last_executed_at: state.lastExecutedAt,
      stats: {
        total: state.stats.total,
        successful: state.stats.successful,
        failed: state.stats.failed,
        total_time: state.stats.totalTime,
        average_time: avgTime,
      },
      quota: state.sandboxed?.quota || {
        memory: 0,
        cpu: 0,
        execution_time: 0,
        network_bytes: 0,
        file_descriptors: 0,
      },
    };
  }

  /**
   * Convert VM error to execution error
   */
  private convertError(error?: {
    code?: string;
    message?: string;
    stack?: string;
  }): CartridgeExecutionError {
    const code = error?.code || "UNKNOWN_ERROR";
    return {
      code,
      message: error?.message || "Unknown error",
      recoverable: this.isRecoverableError(code),
      recovery: this.suggestRecovery(code),
      stack: error?.stack,
    };
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(code: string): boolean {
    const recoverableCodes = [
      VMErrorCode.TIMEOUT,
      VMErrorCode.CPU_LIMIT_EXCEEDED,
      VMErrorCode.RUNTIME_EXCEPTION,
    ];

    return recoverableCodes.includes(code as VMErrorCode);
  }

  /**
   * Suggest recovery action for error
   */
  private suggestRecovery(code: string): RecoveryAction {
    switch (code as VMErrorCode) {
      case VMErrorCode.TIMEOUT:
      case VMErrorCode.CPU_LIMIT_EXCEEDED:
        return "retry";
      case VMErrorCode.RUNTIME_EXCEPTION:
        return "reinitialize";
      case VMErrorCode.OUT_OF_MEMORY:
        return "reload";
      default:
        return "abort";
    }
  }

  /**
   * Shutdown all cartridges
   */
  async shutdown_all(): Promise<void> {
    const cartridgeIds = Array.from(this.cartridges.keys());
    for (const cartridgeId of cartridgeIds) {
      await this.shutdown(cartridgeId);
    }
  }
}

/**
 * Internal cartridge state
 */
interface CartridgeInternalState {
  /** Cartridge ID */
  id: string;

  /** Cartridge manifest */
  manifest: CartridgeManifest;

  /** Current state */
  state: CartridgeInstanceState;

  /** Load timestamp */
  loadedAt: number;

  /** Last execution timestamp */
  lastExecutedAt?: number;

  /** Execution statistics */
  stats: {
    total: number;
    successful: number;
    failed: number;
    totalTime: number;
  };

  /** Sandboxed cartridge reference */
  sandboxed?: SandboxedCartridge;
}

/**
 * Global executor instance
 */
let globalExecutor: SandboxedCartridgeExecutor | undefined;

/**
 * Get or create global executor
 *
 * @param config - Executor configuration
 * @returns SandboxedCartridgeExecutor instance
 */
export function getSandboxedCartridgeExecutor(
  config?: Partial<ExecutorConfig>
): SandboxedCartridgeExecutor {
  if (!globalExecutor) {
    globalExecutor = new SandboxedCartridgeExecutor(
      new WASMSandboxEnhanced(new ArrayBuffer(0)),
      undefined,
      config
    );
  }
  return globalExecutor;
}

/**
 * Reset global executor (for testing)
 */
export function resetSandboxedCartridgeExecutor(): void {
  if (globalExecutor) {
    void globalExecutor.shutdown_all();
  }
  globalExecutor = undefined;
}
