/**
 * @module privacy/vm
 *
 * Cartridge VM Bridge - Connects the cartridge system with the WASM sandbox.
 *
 * This module provides the bridge layer between knowledge cartridges and the
 * secure WebAssembly sandbox environment. It handles:
 * - Loading cartridges into isolated sandboxes
 * - Executing cartridge methods with resource limits
 * - Managing communication channels between host and cartridge
 * - Enforcing security policies and quotas
 *
 * Security considerations:
 * - All cartridges are loaded in isolated WASM sandboxes
 * - Resource quotas prevent resource exhaustion attacks
 * - Communication channels are message-based (no shared memory)
 * - Code signing verification before execution
 * - Escape attempt detection and prevention
 */

import type { CartridgeManifest } from "@lsi/protocol";
import type {
  SecureVM,
  ResourceLimits,
  ResourceUsage,
  ExecutionRequest,
  ExecutionResult,
  VMMessage,
  VerificationResult,
} from "./SecureVM.js";
import {
  WASMSandboxEnhanced,
  EnhancedWASMConfig,
} from "./WASMSandboxEnhanced.js";
import { CodeSigner, Signature } from "./CodeSigner.js";
import { ResourceMonitor, ResourceExhaustion } from "./ResourceMonitor.js";
import {
  createVMError,
  VMErrorCode,
  DEFAULT_RESOURCE_LIMITS,
} from "./SecureVM.js";

/**
 * Cartridge VM configuration
 *
 * Defines the sandbox environment for cartridge execution.
 */
export interface CartridgeVMConfig {
  /** Maximum memory allocation in bytes */
  max_memory: number;

  /** Maximum CPU usage as percentage (0-100) */
  max_cpu: number;

  /** Default execution timeout in milliseconds */
  timeout: number;

  /** Maximum number of concurrent communication channels */
  max_channels: number;

  /** Whether to require code signature verification */
  enable_code_signing: boolean;

  /** List of allowed host function names (whitelist) */
  allowed_host_functions: string[];

  /** Whether to enable escape detection */
  enable_escape_detection: boolean;

  /** Whether to enable file system sandboxing */
  enable_filesystem: boolean;

  /** Whether to enable network sandboxing */
  enable_network: boolean;

  /** Maximum sandbox size in bytes */
  max_sandbox_size: number;
}

/**
 * Default cartridge VM configuration
 *
 * Conservative defaults for security.
 */
export const DEFAULT_CARTRIDGE_VM_CONFIG: CartridgeVMConfig = {
  max_memory: 64 * 1024 * 1024, // 64 MB
  max_cpu: 50, // 50% of one CPU core
  timeout: 5000, // 5 seconds
  max_channels: 10,
  enable_code_signing: true,
  allowed_host_functions: ["log", "error", "warn", "get_time", "get_random"],
  enable_escape_detection: true,
  enable_filesystem: false,
  enable_network: false,
  max_sandbox_size: 128 * 1024 * 1024, // 128 MB
};

/**
 * Resource quota for a cartridge
 *
 * Limits resource consumption during execution.
 */
export interface ResourceQuota {
  /** Memory quota in bytes */
  memory: number;

  /** CPU quota as percentage (0-100) */
  cpu: number;

  /** Execution time quota in milliseconds */
  execution_time: number;

  /** Network quota in bytes (0 = no network) */
  network_bytes: number;

  /** File descriptor quota (0 = no file access) */
  file_descriptors: number;
}

/**
 * Sandboxed cartridge instance
 *
 * Represents a loaded cartridge in its sandbox.
 */
export interface SandboxedCartridge {
  /** Unique cartridge instance ID */
  id: string;

  /** Cartridge manifest */
  manifest: CartridgeManifest;

  /** WASM sandbox instance */
  sandbox: WASMSandboxEnhanced;

  /** Current resource quota */
  quota: ResourceQuota;

  /** Communication channels */
  channels: Map<string, SandboxChannel>;

  /** Cartridge state */
  state: "loaded" | "running" | "paused" | "stopped" | "error";

  /** Load timestamp */
  loadedAt: number;

  /** Last execution timestamp */
  lastExecutedAt?: number;

  /** Execution count */
  executionCount: number;

  /** Total execution time in milliseconds */
  totalExecutionTime: number;
}

/**
 * Cartridge execution result
 *
 * Result of executing a cartridge method.
 */
export interface CartridgeResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Return value if successful */
  data?: unknown;

  /** Error details if failed */
  error?: {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Stack trace if available */
    stack?: string;
  };

  /** Execution time in milliseconds */
  executionTime: number;

  /** Memory used in bytes */
  memoryUsed: number;

  /** CPU used as percentage */
  cpuUsed: number;
}

/**
 * Communication channel configuration
 */
export interface ChannelConfig {
  /** Channel name/ID */
  id: string;

  /** Channel buffer size in bytes */
  buffer_size: number;

  /** Whether channel is bidirectional */
  bidirectional: boolean;

  /** Message timeout in milliseconds */
  timeout: number;
}

/**
 * Sandbox communication channel
 *
 * Message-based communication between host and cartridge.
 */
export interface SandboxChannel {
  /** Unique channel ID */
  id: string;

  /** Whether channel is open */
  is_open(): boolean;

  /** Send message to cartridge */
  send(data: unknown): Promise<void>;

  /** Receive message from cartridge */
  receive(): Promise<unknown>;

  /** Close channel */
  close(): Promise<void>;

  /** Get channel statistics */
  get_stats(): ChannelStats;
}

/**
 * Channel statistics
 */
export interface ChannelStats {
  /** Number of messages sent */
  sent: number;

  /** Number of messages received */
  received: number;

  /** Total bytes transferred */
  bytes: number;

  /** Last message timestamp */
  last_message_at?: number;
}

/**
 * Channel implementation
 */
class ChannelImpl implements SandboxChannel {
  id: string;
  private _isOpen: boolean = true;
  private sendCount: number = 0;
  private receiveCount: number = 0;
  private totalBytes: number = 0;
  private lastMessageAt?: number;
  private messageQueue: unknown[] = [];
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
    this.id = config.id;
  }

  is_open(): boolean {
    return this._isOpen;
  }

  async send(data: unknown): Promise<void> {
    if (!this._isOpen) {
      throw new Error("Channel is closed");
    }

    // Check buffer size limit
    const dataSize = JSON.stringify(data).length;
    if (dataSize > this.config.buffer_size) {
      throw new Error(
        `Message size ${dataSize} exceeds buffer limit ${this.config.buffer_size}`
      );
    }

    this.messageQueue.push(data);
    this.sendCount++;
    this.totalBytes += dataSize;
    this.lastMessageAt = Date.now();
  }

  async receive(): Promise<unknown> {
    if (!this._isOpen && this.messageQueue.length === 0) {
      throw new Error("Channel is closed and empty");
    }

    if (this.messageQueue.length === 0) {
      // Wait for message with timeout
      const startTime = Date.now();
      while (this.messageQueue.length === 0) {
        if (Date.now() - startTime > this.config.timeout) {
          throw new Error("Channel receive timeout");
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const data = this.messageQueue.shift()!;
    this.receiveCount++;
    this.lastMessageAt = Date.now();
    return data;
  }

  async close(): Promise<void> {
    this._isOpen = false;
    this.messageQueue = [];
  }

  get_stats(): ChannelStats {
    return {
      sent: this.sendCount,
      received: this.receiveCount,
      bytes: this.totalBytes,
      last_message_at: this.lastMessageAt,
    };
  }
}

/**
 * Cartridge VM Bridge
 *
 * Bridges the cartridge system with the WASM sandbox.
 * Provides secure cartridge execution with resource limits.
 */
export class CartridgeVMBridge {
  private config: CartridgeVMConfig;
  private sandboxes = new Map<string, SandboxedCartridge>();
  private codeSigner: CodeSigner;
  private resourceMonitor: ResourceMonitor;
  private channelCounter: number = 0;

  constructor(config?: Partial<CartridgeVMConfig>) {
    this.config = { ...DEFAULT_CARTRIDGE_VM_CONFIG, ...config };
    this.codeSigner = new CodeSigner("ED25519");
    this.resourceMonitor = new ResourceMonitor({
      interval: 1000,
      maxSnapshots: 3600,
      autoTerminateOnCritical: true,
      warningThreshold: 80,
    });
  }

  /**
   * Load a cartridge into a sandbox
   *
   * @param manifest - Cartridge manifest
   * @param wasmModule - WebAssembly module binary
   * @param signature - Optional code signature
   * @returns Sandboxed cartridge instance
   */
  async load_cartridge(
    manifest: CartridgeManifest,
    wasmModule: ArrayBuffer,
    signature?: Signature
  ): Promise<SandboxedCartridge> {
    const cartridgeId = `${manifest.id}@${manifest.version}`;

    // Check if already loaded
    if (this.sandboxes.has(cartridgeId)) {
      throw new Error(`Cartridge ${cartridgeId} is already loaded`);
    }

    // Verify code size
    if (wasmModule.byteLength > this.config.max_sandbox_size) {
      throw new Error(
        `WASM module size ${wasmModule.byteLength} exceeds limit ${this.config.max_sandbox_size}`
      );
    }

    // Create enhanced WASM config
    const wasmConfig: EnhancedWASMConfig = {
      initialPages: Math.ceil(this.config.max_memory / (64 * 1024)),
      maxPages: Math.ceil(this.config.max_sandbox_size / (64 * 1024)),
      defaultTimeout: this.config.timeout,
      maxTimeout: this.config.timeout * 6,
      allowConsole: true,
      allowTimer: true,
      allowNetwork: this.config.enable_network,
      allowFileSystem: this.config.enable_filesystem,
      verifySignature: this.config.enable_code_signing,
      allowedOrigins: [],
      enableLogging: true,
      logLevel: "warn",
      expectedSignature: signature,
      enableFileSystem: this.config.enable_filesystem,
      enableNetwork: this.config.enable_network,
      enableChannels: true,
      enableEscapeDetection: this.config.enable_escape_detection,
      grantedCapabilities: [],
    };

    // Create sandbox
    const sandbox = new WASMSandboxEnhanced(wasmModule, wasmConfig);

    // Verify code if signing is enabled
    if (this.config.enable_code_signing && signature) {
      const verification: VerificationResult =
        await sandbox.verifyCode(wasmModule);
      if (!verification.verified) {
        throw new Error(
          `Code signature verification failed: ${verification.warnings.join(", ")}`
        );
      }
    }

    // Start sandbox
    await sandbox.start();

    // Create resource quota
    const quota: ResourceQuota = {
      memory: this.config.max_memory,
      cpu: this.config.max_cpu,
      execution_time: this.config.timeout,
      network_bytes: this.config.enable_network ? 1024 * 1024 : 0, // 1 MB if enabled
      file_descriptors: this.config.enable_filesystem ? 10 : 0,
    };

    // Create sandboxed cartridge
    const sandboxedCartridge: SandboxedCartridge = {
      id: cartridgeId,
      manifest,
      sandbox,
      quota,
      channels: new Map(),
      state: "loaded",
      loadedAt: Date.now(),
      executionCount: 0,
      totalExecutionTime: 0,
    };

    // Start resource monitoring
    const resourceLimits: ResourceLimits = {
      maxMemoryBytes: quota.memory,
      maxCPUMs: quota.cpu * 10, // Convert % to MS
      maxExecutionTime: quota.execution_time,
      maxNetworkAccess: this.config.enable_network,
      maxFileDescriptors: quota.file_descriptors,
    };

    await this.resourceMonitor.monitor(
      sandbox,
      resourceLimits,
      (exhaustion: ResourceExhaustion) =>
        this.handleResourceExhaustion(cartridgeId, exhaustion)
    );

    // Store sandbox
    this.sandboxes.set(cartridgeId, sandboxedCartridge);

    return sandboxedCartridge;
  }

  /**
   * Execute a cartridge method
   *
   * @param cartridgeId - Cartridge instance ID
   * @param method - Method name to execute
   * @param params - Method parameters
   * @returns Execution result
   */
  async execute_method(
    cartridgeId: string,
    method: string,
    params: unknown[]
  ): Promise<CartridgeResult> {
    const cartridge = this.sandboxes.get(cartridgeId);
    if (!cartridge) {
      return {
        success: false,
        error: {
          code: "CARTRIDGE_NOT_FOUND",
          message: `Cartridge ${cartridgeId} not found`,
        },
        executionTime: 0,
        memoryUsed: 0,
        cpuUsed: 0,
      };
    }

    // Check state
    if (cartridge.state === "stopped" || cartridge.state === "error") {
      return {
        success: false,
        error: {
          code: "INVALID_STATE",
          message: `Cannot execute cartridge in state ${cartridge.state}`,
        },
        executionTime: 0,
        memoryUsed: 0,
        cpuUsed: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Update state
      cartridge.state = "running";

      // Create execution request
      const request: ExecutionRequest = {
        functionName: method,
        args: params,
        timeout: cartridge.quota.execution_time,
        memoryLimit: cartridge.quota.memory,
      };

      // Execute in sandbox
      const result: ExecutionResult = await cartridge.sandbox.execute(request);

      // Update statistics
      const executionTime = Date.now() - startTime;
      cartridge.executionCount++;
      cartridge.totalExecutionTime += executionTime;
      cartridge.lastExecutedAt = Date.now();
      cartridge.state = "loaded";

      // Get resource usage
      const usage = cartridge.sandbox.getResourceUsage();

      if (!result.success) {
        return {
          success: false,
          error: {
            code: result.error?.code || "EXECUTION_FAILED",
            message: result.error?.message || "Unknown error",
            stack: result.error?.stack,
          },
          executionTime,
          memoryUsed: result.memoryUsed,
          cpuUsed: usage.cpuPercent,
        };
      }

      return {
        success: true,
        data: result.returnValue,
        executionTime,
        memoryUsed: result.memoryUsed,
        cpuUsed: usage.cpuPercent,
      };
    } catch (error) {
      cartridge.state = "error";
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: {
          code: "RUNTIME_EXCEPTION",
          message: error instanceof Error ? error.message : String(error),
        },
        executionTime,
        memoryUsed: 0,
        cpuUsed: 0,
      };
    }
  }

  /**
   * Create a communication channel
   *
   * @param channelId - Channel ID
   * @param config - Channel configuration
   * @returns Communication channel
   */
  async create_channel(
    channelId: string,
    config?: Partial<ChannelConfig>
  ): Promise<SandboxChannel> {
    const fullConfig: ChannelConfig = {
      id: channelId,
      buffer_size: 64 * 1024, // 64 KB default
      bidirectional: true,
      timeout: 5000, // 5 seconds
      ...config,
    };

    const channel = new ChannelImpl(fullConfig);
    return channel;
  }

  /**
   * Set resource quota for a cartridge
   *
   * @param cartridgeId - Cartridge instance ID
   * @param quota - New resource quota
   */
  set_quota(cartridgeId: string, quota: ResourceQuota): void {
    const cartridge = this.sandboxes.get(cartridgeId);
    if (!cartridge) {
      throw new Error(`Cartridge ${cartridgeId} not found`);
    }

    cartridge.quota = quota;

    // Update sandbox limits
    const limits: ResourceLimits = {
      maxMemoryBytes: quota.memory,
      maxCPUMs: quota.cpu * 10,
      maxExecutionTime: quota.execution_time,
      maxNetworkAccess: quota.network_bytes > 0,
      maxFileDescriptors: quota.file_descriptors,
    };

    void cartridge.sandbox.setResourceLimits(limits);
  }

  /**
   * Get current resource usage for a cartridge
   *
   * @param cartridgeId - Cartridge instance ID
   * @returns Resource usage
   */
  get_usage(cartridgeId: string): ResourceUsage {
    const cartridge = this.sandboxes.get(cartridgeId);
    if (!cartridge) {
      throw new Error(`Cartridge ${cartridgeId} not found`);
    }

    return cartridge.sandbox.getResourceUsage();
  }

  /**
   * Unload a cartridge
   *
   * @param cartridgeId - Cartridge instance ID
   */
  async unload_cartridge(cartridgeId: string): Promise<void> {
    const cartridge = this.sandboxes.get(cartridgeId);
    if (!cartridge) {
      return; // Already unloaded
    }

    // Stop monitoring
    this.resourceMonitor.stop(cartridgeId);

    // Close all channels
    const channels = Array.from(cartridge.channels.values());
    for (const channel of channels) {
      await channel.close();
    }
    cartridge.channels.clear();

    // Stop sandbox
    await cartridge.sandbox.stop();

    // Remove from map
    this.sandboxes.delete(cartridgeId);
  }

  /**
   * List all loaded cartridges
   *
   * @returns Array of cartridge IDs
   */
  list_loaded(): string[] {
    return Array.from(this.sandboxes.keys());
  }

  /**
   * Get sandbox info for a cartridge
   *
   * @param cartridgeId - Cartridge instance ID
   * @returns Sandboxed cartridge info or undefined
   */
  get_cartridge(cartridgeId: string): SandboxedCartridge | undefined {
    return this.sandboxes.get(cartridgeId);
  }

  /**
   * Handle resource exhaustion event
   *
   * @param cartridgeId - Cartridge ID
   * @param exhaustion - Resource exhaustion details
   */
  private handleResourceExhaustion(
    cartridgeId: string,
    exhaustion: ResourceExhaustion
  ): void {
    const cartridge = this.sandboxes.get(cartridgeId);
    if (!cartridge) {
      return;
    }

    // Log security event
    console.warn(`Resource exhaustion for ${cartridgeId}:`, exhaustion);

    if (exhaustion.severity === "critical") {
      // Mark as error state
      cartridge.state = "error";
    }
  }

  /**
   * Shutdown all cartridges
   */
  async shutdown(): Promise<void> {
    const cartridges = Array.from(this.sandboxes.keys());
    for (const cartridgeId of cartridges) {
      await this.unload_cartridge(cartridgeId);
    }
    this.resourceMonitor.stopAll();
  }
}

/**
 * Global cartridge VM bridge instance
 */
let globalCartridgeVMBridge: CartridgeVMBridge | undefined;

/**
 * Get or create global cartridge VM bridge
 *
 * @param config - Bridge configuration
 * @returns CartridgeVMBridge instance
 */
export function getCartridgeVMBridge(
  config?: Partial<CartridgeVMConfig>
): CartridgeVMBridge {
  if (!globalCartridgeVMBridge) {
    globalCartridgeVMBridge = new CartridgeVMBridge(config);
  }
  return globalCartridgeVMBridge;
}

/**
 * Reset global cartridge VM bridge (for testing)
 */
export function resetCartridgeVMBridge(): void {
  if (globalCartridgeVMBridge) {
    void globalCartridgeVMBridge.shutdown();
  }
  globalCartridgeVMBridge = undefined;
}
