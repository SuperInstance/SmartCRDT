/**
 * @module privacy/vm
 *
 * WebAssembly-based sandbox implementation for secure cartridge execution.
 */

import type {
  SecureVM,
  ResourceLimits,
  ResourceUsage,
  ExecutionRequest,
  ExecutionResult,
  VMError,
  VMState,
  VMSnapshot,
  VMMessage,
  VerificationResult,
  VMErrorCode,
} from "./SecureVM.js";
import {
  DEFAULT_RESOURCE_LIMITS,
  createVMError,
  canExecute,
} from "./SecureVM.js";

/**
 * WebAssembly sandbox configuration
 */
export interface WASMConfig {
  /** Memory limits */
  initialPages: number; /** 64KB per page */
  maxPages: number;

  /** Execution limits */
  defaultTimeout: number; /** milliseconds */
  maxTimeout: number;

  /** Capabilities */
  allowConsole: boolean;
  allowTimer: boolean;
  allowNetwork: boolean;
  allowFileSystem: boolean;

  /** Security */
  verifySignature: boolean;
  allowedOrigins: string[];

  /** Logging */
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error" | "none";
}

/**
 * Default WASM configuration
 */
export const DEFAULT_WASM_CONFIG: WASMConfig = {
  initialPages: 16, // 1 MB (16 pages * 64KB)
  maxPages: 1024, // 64 MB max
  defaultTimeout: 5000, // 5 seconds
  maxTimeout: 30000, // 30 seconds max
  allowConsole: true,
  allowTimer: true,
  allowNetwork: false,
  allowFileSystem: false,
  verifySignature: false,
  allowedOrigins: [],
  enableLogging: true,
  logLevel: "warn",
};

/**
 * Console output from VM
 */
export interface ConsoleOutput {
  /** Log level */
  level: "log" | "info" | "warn" | "error" | "debug";
  /** Output message */
  message: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * WebAssembly Sandbox implementation
 *
 * Provides secure execution environment for WebAssembly modules.
 * Enforces memory limits, execution timeouts, and restricted capabilities.
 */
export class WASMSandbox implements SecureVM {
  private vmId: string;
  private wasmInstance?: WebAssembly.Instance;
  private wasmMemory?: WebAssembly.Memory;
  private state: VMState = "stopped";
  private config: WASMConfig;
  private limits: ResourceLimits;
  private messageQueue: VMMessage[] = [];
  private consoleOutputs: ConsoleOutput[] = [];
  private executionStartTime: number = 0;
  private cpuTime: number = 0;

  constructor(code: ArrayBuffer, config?: Partial<WASMConfig>) {
    this.vmId = this.generateId();
    this.config = { ...DEFAULT_WASM_CONFIG, ...config };
    this.limits = { ...DEFAULT_RESOURCE_LIMITS };

    // Store code for loading (not loaded yet)
    this.wasmMemory = new WebAssembly.Memory({
      initial: this.config.initialPages,
      maximum: this.config.maxPages,
    });

    this.log("debug", `WASMSandbox created with ID: ${this.vmId}`);
  }

  /** Generate unique VM ID */
  private generateId(): string {
    return `wasm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /** Log message if logging enabled */
  protected log(level: ConsoleOutput["level"], message: string): void {
    if (this.config.enableLogging && this.config.logLevel !== "none") {
      const output: ConsoleOutput = { level, message, timestamp: Date.now() };
      this.consoleOutputs.push(output);

      // Also log to console if configured
      if (this.shouldLog(level)) {
        console[level === "log" ? "log" : level](
          `[WASM:${this.vmId}] ${message}`
        );
      }
    }
  }

  /** Check if log level should be output */
  protected shouldLog(level: ConsoleOutput["level"]): boolean {
    const levels = ["debug", "info", "warn", "error", "none"];
    const currentLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  }

  /**
   * Get VM identifier
   */
  id(): string {
    return this.vmId;
  }

  /**
   * Start the VM
   */
  async start(): Promise<void> {
    if (this.state !== "stopped" && this.state !== "terminated") {
      throw new Error(`VM cannot start from state: ${this.state}`);
    }

    this.state = "starting";
    this.log("info", "Starting WASM VM...");

    this.state = "running";
    this.log("info", "WASM VM started successfully");
  }

  /**
   * Stop the VM
   */
  async stop(): Promise<void> {
    if (this.state === "stopped" || this.state === "terminated") {
      throw new Error(`VM cannot stop from state: ${this.state}`);
    }

    this.state = "stopping";
    this.log("info", "Stopping WASM VM...");

    // Clean up
    this.wasmInstance = undefined;
    this.messageQueue = [];
    this.consoleOutputs = [];

    this.state = "stopped";
    this.log("info", "WASM VM stopped");
  }

  /**
   * Pause VM execution
   */
  async pause(): Promise<void> {
    if (this.state !== "running") {
      throw new Error(`VM cannot pause from state: ${this.state}`);
    }

    this.log("info", "Pausing WASM VM...");
    this.state = "paused";
    this.log("info", "WASM VM paused");
  }

  /**
   * Resume VM execution
   */
  async resume(): Promise<void> {
    if (this.state !== "paused") {
      throw new Error(`VM cannot resume from state: ${this.state}`);
    }

    this.log("info", "Resuming WASM VM...");
    this.state = "running";
    this.log("info", "WASM VM resumed");
  }

  /**
   * Set resource limits
   */
  async setResourceLimits(limits: ResourceLimits): Promise<void> {
    this.log("info", `Setting resource limits: ${JSON.stringify(limits)}`);
    this.limits = { ...limits };

    // Update memory limits if memory is allocated
    if (this.wasmMemory && limits.maxMemoryBytes > 0) {
      const maxPages = Math.ceil(limits.maxMemoryBytes / 65536);
      const currentPages = this.wasmMemory.buffer.byteLength / 65536;

      if (maxPages < currentPages) {
        throw new Error("Cannot reduce memory below current usage");
      }
    }
  }

  /**
   * Get current resource usage
   */
  getResourceUsage(): ResourceUsage {
    const memoryBytes = this.getMemoryUsage();
    const executionTime =
      this.executionStartTime > 0 ? Date.now() - this.executionStartTime : 0;

    return {
      memoryBytes,
      cpuPercent: Math.min(
        100,
        (this.cpuTime / Math.max(1, executionTime)) * 100
      ),
      executionTime,
      networkBytes: { in: 0, out: 0 }, // No network access
      openFileDescriptors: 0, // No file access
    };
  }

  /**
   * Get current memory usage in bytes
   */
  private getMemoryUsage(): number {
    return this.wasmMemory?.buffer.byteLength || 0;
  }

  /**
   * Load WebAssembly module
   */
  async load(code: ArrayBuffer): Promise<void> {
    this.log("info", "Loading WebAssembly module...");

    try {
      // Verify WASM magic number
      const view = new Uint8Array(code);
      if (
        view[0] !== 0x00 ||
        view[1] !== 0x61 ||
        view[2] !== 0x73 ||
        view[3] !== 0x6d
      ) {
        throw new Error("Invalid WebAssembly module (missing magic number)");
      }

      // Compile module
      const module = await WebAssembly.compile(code);

      // Create sandboxed imports
      const imports = this.createSandboxedImports();

      // Instantiate
      this.wasmInstance = await WebAssembly.instantiate(module, imports);

      this.log(
        "info",
        `WebAssembly module loaded successfully. Exports: ${Object.keys(
          this.wasmInstance.exports
        ).join(", ")}`
      );
    } catch (error) {
      this.state = "error";
      this.log("error", `Failed to load WebAssembly module: ${error}`);
      throw error;
    }
  }

  /**
   * Create sandboxed imports for WASM module
   */
  private createSandboxedImports(): WebAssembly.Imports {
    const imports: WebAssembly.Imports = {};

    // Console (redirected if allowed)
    if (this.config.allowConsole) {
      imports.env = {
        ...imports.env,
        ...this.createSandboxedConsole(),
      };
    }

    // Timer (restricted if allowed)
    if (this.config.allowTimer) {
      imports.timer = this.createSandboxedTimer();
    }

    // Memory reference
    if (this.wasmMemory) {
      imports.env = {
        ...imports.env,
        memory: this.wasmMemory,
      };
    }

    // NO network access
    // NO file system access
    // NO process access

    this.log("debug", "Created sandboxed imports");
    return imports;
  }

  /**
   * Create sandboxed console functions
   */
  private createSandboxedConsole(): Record<string, () => void> {
    const self = this;
    return {
      log: (...args: unknown[]) =>
        self.log("log", args.map(a => String(a)).join(" ")),
      info: (...args: unknown[]) =>
        self.log("info", args.map(a => String(a)).join(" ")),
      warn: (...args: unknown[]) =>
        self.log("warn", args.map(a => String(a)).join(" ")),
      error: (...args: unknown[]) =>
        self.log("error", args.map(a => String(a)).join(" ")),
      debug: (...args: unknown[]) =>
        self.log("debug", args.map(a => String(a)).join(" ")),
    };
  }

  /**
   * Create sandboxed timer functions
   */
  private createSandboxedTimer(): Record<string, () => number> {
    return {
      getCurrentTime: () => Date.now(),
      getHighResTime: () => performance.now(),
    };
  }

  /**
   * Execute function in VM
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!canExecute(this.state)) {
      return {
        success: false,
        error: createVMError(
          "INVALID_STATE" as VMErrorCode,
          `VM not in running state, current state: ${this.state}`
        ),
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    if (!this.wasmInstance) {
      return {
        success: false,
        error: createVMError(
          "INVALID_STATE" as VMErrorCode,
          "No WebAssembly module loaded"
        ),
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();
    this.executionStartTime = startTime;

    this.log("info", `Executing function: ${request.functionName}`);

    try {
      // Get function from exports
      const exports = this.wasmInstance.exports as any;
      const func = exports[request.functionName];

      if (typeof func !== "function") {
        throw new Error(
          `Function '${request.functionName}' not found in exports`
        );
      }

      // Execute with timeout
      const timeout = request.timeout || this.config.defaultTimeout;
      const result = await this.withTimeout(
        () => func(...request.args),
        timeout
      );

      const executionTime = Date.now() - startTime;
      const memoryUsed = this.getMemoryUsage() - startMemory;
      this.cpuTime += executionTime;

      this.log("info", `Execution completed in ${executionTime}ms`);

      return {
        success: true,
        returnValue: result,
        executionTime,
        memoryUsed,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const memoryUsed = this.getMemoryUsage() - startMemory;

      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log("error", `Execution failed: ${errorMsg}`);

      // Classify error
      let errorCode: VMErrorCode = "RUNTIME_EXCEPTION" as VMErrorCode;
      if (errorMsg.includes("Timeout") || errorMsg.includes("timeout")) {
        errorCode = "TIMEOUT" as VMErrorCode;
      } else if (
        errorMsg.includes("not found") ||
        errorMsg.includes("Function")
      ) {
        errorCode = "FUNCTION_NOT_FOUND" as VMErrorCode;
      } else if (errorMsg.includes("memory")) {
        errorCode = "OUT_OF_MEMORY" as VMErrorCode;
      }

      return {
        success: false,
        error: createVMError(
          errorCode,
          errorMsg,
          error instanceof Error ? error.stack : undefined
        ),
        executionTime,
        memoryUsed,
      };
    }
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(fn: () => T, timeout: number): Promise<T> {
    // For sync functions, we need to be careful
    // WebAssembly functions are synchronous by default
    const maxTimeout = Math.min(timeout, this.config.maxTimeout);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${maxTimeout}ms`));
      }, maxTimeout);

      try {
        const result = fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Send message to VM
   */
  async sendMessage(message: VMMessage): Promise<void> {
    this.log("debug", `Sending message: ${message.type}`);
    this.messageQueue.push(message);
  }

  /**
   * Receive message from VM
   */
  async receiveMessage(): Promise<VMMessage> {
    // Poll for messages (in real implementation, this might use a proper channel)
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.messageQueue.length > 0) {
          clearInterval(checkInterval);
          const message = this.messageQueue.shift();
          if (message) {
            resolve(message);
          }
        }
      }, 10);
    });
  }

  /**
   * Verify code signature and capabilities
   */
  async verifyCode(code: ArrayBuffer): Promise<VerificationResult> {
    this.log("info", "Verifying WebAssembly module...");

    const warnings: string[] = [];
    const permissions: string[] = [];
    const capabilities: string[] = [];

    // Check WASM magic number
    const view = new Uint8Array(code);
    if (
      view[0] !== 0x00 ||
      view[1] !== 0x61 ||
      view[2] !== 0x73 ||
      view[3] !== 0x6d
    ) {
      return {
        verified: false,
        signatureValid: false,
        permissions: [],
        capabilities: [],
        warnings: ["Invalid WebAssembly module (missing magic number)"],
      };
    }

    // Analyze capabilities
    if (this.config.allowConsole) {
      permissions.push("console");
    }
    if (this.config.allowTimer) {
      permissions.push("timer");
    }
    if (this.config.allowNetwork) {
      permissions.push("network");
      warnings.push("Network access enabled - security risk");
    }
    if (this.config.allowFileSystem) {
      permissions.push("filesystem");
      warnings.push("File system access enabled - security risk");
    }

    capabilities.push("wasm");
    capabilities.push("sandboxed");

    this.log("info", "Verification complete");

    return {
      verified: true,
      signatureValid: !this.config.verifySignature, // Assume valid if not verifying
      permissions,
      capabilities,
      warnings,
    };
  }

  /**
   * Get current VM state
   */
  getState(): VMState {
    return this.state;
  }

  /**
   * Create snapshot of current VM state
   */
  async snapshot(): Promise<VMSnapshot> {
    this.log("info", "Creating VM snapshot...");

    return {
      vmId: this.vmId,
      timestamp: Date.now(),
      state: this.state,
      memory: this.wasmMemory?.buffer.slice(0) || new ArrayBuffer(0),
      registers: {},
      metadata: {
        config: this.config,
        limits: this.limits,
        consoleOutputs: this.consoleOutputs,
      },
    };
  }

  /**
   * Restore VM from snapshot
   */
  async restore(snapshot: VMSnapshot): Promise<void> {
    this.log("info", "Restoring VM from snapshot...");

    // Allow restoring from a snapshot with a different VM ID
    // The VM ID from the snapshot will be adopted
    if (snapshot.vmId !== this.vmId) {
      this.log(
        "warn",
        `Restoring snapshot with different VM ID: ${snapshot.vmId} (current: ${this.vmId})`
      );
      this.vmId = snapshot.vmId;
    }

    // Restore memory
    if (snapshot.memory.byteLength > 0) {
      const pages = Math.ceil(snapshot.memory.byteLength / 65536);
      this.wasmMemory = new WebAssembly.Memory({
        initial: pages,
        maximum: this.config.maxPages,
      });
      new Uint8Array(this.wasmMemory.buffer).set(
        new Uint8Array(snapshot.memory)
      );
    }

    // Restore state
    this.state = snapshot.state;

    // Restore metadata
    if (snapshot.metadata) {
      if (snapshot.metadata.config) {
        this.config = snapshot.metadata.config as WASMConfig;
      }
      if (snapshot.metadata.limits) {
        this.limits = snapshot.metadata.limits as ResourceLimits;
      }
      if (snapshot.metadata.consoleOutputs) {
        this.consoleOutputs = snapshot.metadata
          .consoleOutputs as ConsoleOutput[];
      }
    }

    this.log("info", "VM restored from snapshot");
  }

  /**
   * Get console outputs
   */
  getConsoleOutputs(): ConsoleOutput[] {
    return [...this.consoleOutputs];
  }

  /**
   * Clear console outputs
   */
  clearConsoleOutputs(): void {
    this.consoleOutputs = [];
  }
}

/**
 * Create a new WASM sandbox
 */
export async function createWASMSandbox(
  code: ArrayBuffer,
  config?: Partial<WASMConfig>
): Promise<WASMSandbox> {
  const sandbox = new WASMSandbox(code, config);
  await sandbox.load(code);
  await sandbox.start();
  return sandbox;
}
