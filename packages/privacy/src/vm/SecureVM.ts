/**
 * @module privacy/vm
 *
 * Secure VM interfaces for executing untrusted knowledge cartridges.
 * Provides WebAssembly-based sandboxing with resource limits and isolation.
 */

/**
 * Resource limits for VM execution
 */
export interface ResourceLimits {
  /** Maximum memory allocation in bytes */
  maxMemoryBytes: number;
  /** Maximum CPU time in milliseconds */
  maxCPUMs: number;
  /** Maximum execution time in milliseconds */
  maxExecutionTime: number;
  /** Whether network access is allowed */
  maxNetworkAccess: boolean;
  /** Maximum number of open file descriptors */
  maxFileDescriptors: number;
}

/**
 * Current resource usage statistics
 */
export interface ResourceUsage {
  /** Current memory usage in bytes */
  memoryBytes: number;
  /** Current CPU usage as percentage (0-100) */
  cpuPercent: number;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Network bytes transferred */
  networkBytes: {
    /** Bytes received */
    in: number;
    /** Bytes sent */
    out: number;
  };
  /** Number of open file descriptors */
  openFileDescriptors: number;
}

/**
 * Execution request for VM function call
 */
export interface ExecutionRequest {
  /** Name of the function to execute */
  functionName: string;
  /** Arguments to pass to the function */
  args: unknown[];
  /** Optional timeout in milliseconds (overrides default) */
  timeout?: number;
  /** Optional memory limit in bytes (overrides default) */
  memoryLimit?: number;
}

/**
 * Result from VM execution
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Return value if successful */
  returnValue?: unknown;
  /** Error details if failed */
  error?: VMError;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Memory used during execution in bytes */
  memoryUsed: number;
}

/**
 * VM error details
 */
export interface VMError {
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional stack trace */
  stack?: string;
}

/**
 * VM state lifecycle
 */
export type VMState =
  | "stopped" /** VM is not running */
  | "starting" /** VM is initializing */
  | "running" /** VM is ready for execution */
  | "paused" /** VM is paused */
  | "stopping" /** VM is shutting down */
  | "error" /** VM encountered an error */
  | "terminated"; /** VM was forcibly terminated */

/**
 * VM snapshot for save/restore functionality
 */
export interface VMSnapshot {
  /** Unique VM identifier */
  vmId: string;
  /** Snapshot timestamp (Unix epoch) */
  timestamp: number;
  /** VM state at time of snapshot */
  state: VMState;
  /** Memory contents */
  memory: ArrayBuffer;
  /** Register values (architecture-specific) */
  registers: Record<string, unknown>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message for VM communication
 */
export interface VMMessage {
  /** Message type identifier */
  type: string;
  /** Message payload */
  payload: unknown;
  /** Message timestamp */
  timestamp: number;
  /** Optional sender identifier */
  sender?: string;
}

/**
 * Code verification result
 */
export interface VerificationResult {
  /** Whether verification passed */
  verified: boolean;
  /** Whether digital signature is valid */
  signatureValid: boolean;
  /** Granted permissions */
  permissions: string[];
  /** Discovered capabilities */
  capabilities: string[];
  /** Verification warnings */
  warnings: string[];
}

/**
 * Secure VM interface
 *
 * Provides a secure execution environment for untrusted code.
 * Implementations must enforce resource limits and provide isolation.
 */
export interface SecureVM {
  /**
   * Get unique VM identifier
   */
  id(): string;

  /**
   * Start the VM
   * @throws Error if VM is already running or fails to start
   */
  start(): Promise<void>;

  /**
   * Stop the VM gracefully
   * @throws Error if VM is not running
   */
  stop(): Promise<void>;

  /**
   * Pause VM execution (freeze state)
   * @throws Error if VM is not running
   */
  pause(): Promise<void>;

  /**
   * Resume VM execution from paused state
   * @throws Error if VM is not paused
   */
  resume(): Promise<void>;

  /**
   * Set resource limits for VM execution
   * @param limits - Resource limits to apply
   * @throws Error if limits are invalid or cannot be enforced
   */
  setResourceLimits(limits: ResourceLimits): Promise<void>;

  /**
   * Get current resource usage statistics
   * @returns Current resource usage
   */
  getResourceUsage(): ResourceUsage;

  /**
   * Execute a function within the VM
   * @param request - Execution request with function name and args
   * @returns Execution result with return value or error
   */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;

  /**
   * Send a message to the VM
   * @param message - Message to send
   */
  sendMessage(message: VMMessage): Promise<void>;

  /**
   * Receive a message from the VM (blocks if no message available)
   * @returns Message from VM
   */
  receiveMessage(): Promise<VMMessage>;

  /**
   * Verify code signature and capabilities
   * @param code - Code binary to verify
   * @returns Verification result with permissions and capabilities
   */
  verifyCode(code: ArrayBuffer): Promise<VerificationResult>;

  /**
   * Get current VM state
   * @returns Current VM state
   */
  getState(): VMState;

  /**
   * Create a snapshot of current VM state
   * @returns VM snapshot
   */
  snapshot(): Promise<VMSnapshot>;

  /**
   * Restore VM from a snapshot
   * @param snapshot - Snapshot to restore from
   */
  restore(snapshot: VMSnapshot): Promise<void>;
}

/**
 * Error codes for VM execution
 */
export enum VMErrorCode {
  /** Unknown error */
  UNKNOWN = "UNKNOWN",
  /** Function not found in VM exports */
  FUNCTION_NOT_FOUND = "FUNCTION_NOT_FOUND",
  /** Execution timeout exceeded */
  TIMEOUT = "TIMEOUT",
  /** Memory limit exceeded */
  OUT_OF_MEMORY = "OUT_OF_MEMORY",
  /** CPU limit exceeded */
  CPU_LIMIT_EXCEEDED = "CPU_LIMIT_EXCEEDED",
  /** Invalid function arguments */
  INVALID_ARGUMENTS = "INVALID_ARGUMENTS",
  /** Runtime exception in VM code */
  RUNTIME_EXCEPTION = "RUNTIME_EXCEPTION",
  /** Verification failed */
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  /** Permission denied */
  PERMISSION_DENIED = "PERMISSION_DENIED",
  /** Network access denied */
  NETWORK_ACCESS_DENIED = "NETWORK_ACCESS_DENIED",
  /** File system access denied */
  FS_ACCESS_DENIED = "FS_ACCESS_DENIED",
  /** VM not in valid state for operation */
  INVALID_STATE = "INVALID_STATE",
}

/**
 * Default resource limits for VM execution
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxMemoryBytes: 64 * 1024 * 1024, // 64 MB
  maxCPUMs: 1000, // 1 second
  maxExecutionTime: 5000, // 5 seconds
  maxNetworkAccess: false, // No network by default
  maxFileDescriptors: 0, // No file access by default
};

/**
 * Create a VM error from error code and message
 */
export function createVMError(
  code: VMErrorCode,
  message: string,
  stack?: string
): VMError {
  return {
    code,
    message,
    stack,
  };
}

/**
 * Check if VM state allows execution
 */
export function canExecute(state: VMState): boolean {
  return state === "running";
}

/**
 * Check if VM state allows state changes
 */
export function canChangeState(state: VMState): boolean {
  return state !== "terminated" && state !== "error";
}
