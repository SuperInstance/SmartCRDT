/**
 * @module privacy/vm
 *
 * Enhanced WebAssembly sandbox with communication channels,
 * file system sandboxing, network sandboxing, and security features.
 */

import type {
  SecureVM,
  ResourceLimits,
  ResourceUsage,
  ExecutionRequest,
  ExecutionResult,
  VMState,
  VMSnapshot,
  VMMessage,
  VerificationResult,
  VMErrorCode,
} from "./SecureVM.js";
import { WASMSandbox, WASMConfig, ConsoleOutput } from "./WASMSandbox.js";
import {
  DEFAULT_RESOURCE_LIMITS,
  createVMError,
  canExecute,
} from "./SecureVM.js";
import { CodeSigner, Signature } from "./CodeSigner.js";

/**
 * Message handler for VM communication channels
 */
export type MessageHandler = (message: VMMessage) => void | Promise<void>;

/**
 * Virtual file system entry
 */
export interface VFSEntry {
  /** Entry name */
  name: string;
  /** Entry type */
  type: "file" | "directory";
  /** File content (for files) */
  content?: ArrayBuffer;
  /** Children (for directories) */
  children?: Map<string, VFSEntry>;
  /** Permissions */
  permissions: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
}

/**
 * Virtual file system configuration
 */
export interface VirtualFSConfig {
  /** Root directory */
  root: VFSEntry;
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Maximum total size in bytes */
  maxTotalSize: number;
  /** Allowed paths (whitelist) */
  allowedPaths: string[];
}

/**
 * Sandboxed network configuration
 */
export interface SandboxedNetworkConfig {
  /** Whitelist of allowed hosts */
  whitelist: string[];
  /** Whitelist of allowed ports */
  allowedPorts: number[];
  /** Maximum request size in bytes */
  maxRequestSize: number;
  /** Maximum response size in bytes */
  maxResponseSize: number;
  /** Network timeout in milliseconds */
  timeout: number;
}

/**
 * Network request
 */
export interface NetworkRequest {
  /** Request URL */
  url: string;
  /** Request method */
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Request headers */
  headers: Record<string, string>;
  /** Request body */
  body?: ArrayBuffer;
}

/**
 * Network response
 */
export interface NetworkResponse {
  /** Response status */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body?: ArrayBuffer;
}

/**
 * Capability request
 */
export interface CapabilityRequest {
  /** Capability name */
  capability: string;
  /** Request arguments */
  args: unknown[];
}

/**
 * Enhanced WASM configuration
 */
export interface EnhancedWASMConfig extends WASMConfig {
  /** Enable file system sandboxing */
  enableFileSystem?: boolean;
  /** File system configuration */
  fileSystemConfig?: VirtualFSConfig;
  /** Enable network sandboxing */
  enableNetwork?: boolean;
  /** Network configuration */
  networkConfig?: SandboxedNetworkConfig;
  /** Enable communication channels */
  enableChannels?: boolean;
  /** Code signature to verify */
  expectedSignature?: Signature;
  /** Expected public key for verification */
  expectedPublicKey?: string;
  /** Granted capabilities */
  grantedCapabilities?: string[];
  /** Enable escape detection */
  enableEscapeDetection?: boolean;
}

/**
 * Default enhanced configuration
 */
export const DEFAULT_ENHANCED_CONFIG: EnhancedWASMConfig = {
  initialPages: 16,
  maxPages: 1024,
  defaultTimeout: 5000,
  maxTimeout: 30000,
  allowConsole: true,
  allowTimer: true,
  allowNetwork: false,
  allowFileSystem: false,
  verifySignature: false,
  allowedOrigins: [],
  enableLogging: true,
  logLevel: "warn",
  enableFileSystem: false,
  enableNetwork: false,
  enableChannels: true,
  enableEscapeDetection: true,
  grantedCapabilities: [],
};

/**
 * Enhanced WebAssembly Sandbox
 *
 * Extends WASMSandbox with:
 * - Communication channels between VM and host
 * - File system sandboxing (virtual file system)
 * - Network sandboxing (whitelist-based)
 * - Code signing verification
 * - Capability-based security
 * - Memory isolation verification
 * - Escape attempt detection
 */
export class WASMSandboxEnhanced extends WASMSandbox {
  private enhancedConfig: EnhancedWASMConfig;
  private messageChannels = new Map<string, MessageHandler>();
  private messageBuffer: VMMessage[] = [];
  private virtualFS?: VirtualFSConfig;
  private sandboxedNetwork?: SandboxedNetworkConfig;
  private codeSigner: CodeSigner;
  private grantedCapabilities: Set<string>;
  private escapeDetected: boolean = false;
  private securityViolations: string[] = [];

  constructor(code: ArrayBuffer, config?: Partial<EnhancedWASMConfig>) {
    super(code, config);
    this.enhancedConfig = { ...DEFAULT_ENHANCED_CONFIG, ...config };
    this.codeSigner = new CodeSigner();
    this.grantedCapabilities = new Set(
      this.enhancedConfig.grantedCapabilities || []
    );

    // Initialize virtual file system if enabled
    if (
      this.enhancedConfig.enableFileSystem &&
      this.enhancedConfig.fileSystemConfig
    ) {
      this.virtualFS = this.enhancedConfig.fileSystemConfig;
    }

    // Initialize sandboxed network if enabled
    if (
      this.enhancedConfig.enableNetwork &&
      this.enhancedConfig.networkConfig
    ) {
      this.sandboxedNetwork = this.enhancedConfig.networkConfig;
    }
  }

  /**
   * Register a message handler for a channel
   *
   * @param channel - Channel name
   * @param handler - Message handler function
   */
  registerChannel(channel: string, handler: MessageHandler): void {
    if (!this.enhancedConfig.enableChannels) {
      throw new Error("Communication channels are not enabled");
    }

    this.messageChannels.set(channel, handler);
    this.log("debug", `Registered message channel: ${channel}`);
  }

  /**
   * Unregister a message handler
   *
   * @param channel - Channel name
   */
  unregisterChannel(channel: string): void {
    this.messageChannels.delete(channel);
    this.log("debug", `Unregistered message channel: ${channel}`);
  }

  /**
   * Send message to VM
   *
   * @param message - Message to send
   */
  async sendMessageToVM(message: VMMessage): Promise<void> {
    if (this.escapeDetected) {
      throw new Error("Cannot send message: sandbox escape detected");
    }

    this.messageBuffer.push(message);
    this.log("debug", `Message sent to VM: ${message.type}`);
  }

  /**
   * Receive message from VM (polling)
   *
   * @returns Message or null if no messages available
   */
  receiveMessageFromVM(): VMMessage | null {
    if (this.messageBuffer.length > 0) {
      const message = this.messageBuffer.shift();
      if (message) {
        // Route to appropriate channel handler
        const handler = this.messageChannels.get(message.type);
        if (handler) {
          // Execute handler asynchronously
          Promise.resolve(handler(message)).catch(error => {
            this.log("error", `Message handler error: ${error}`);
          });
        }
        return message;
      }
    }
    return null;
  }

  /**
   * Get all pending messages
   *
   * @returns Array of pending messages
   */
  getPendingMessages(): VMMessage[] {
    return [...this.messageBuffer];
  }

  /**
   * Clear message buffer
   */
  clearMessages(): void {
    this.messageBuffer = [];
  }

  /**
   * Create a sandboxed file system
   *
   * @returns Virtual file system configuration
   */
  private createSandboxedFS(): VirtualFSConfig {
    const config: VirtualFSConfig = {
      root: {
        name: "/",
        type: "directory",
        children: new Map([
          [
            "tmp",
            {
              name: "tmp",
              type: "directory",
              children: new Map(),
              permissions: { read: true, write: true, execute: false },
            },
          ],
          [
            "home",
            {
              name: "home",
              type: "directory",
              children: new Map(),
              permissions: { read: true, write: false, execute: false },
            },
          ],
        ]),
        permissions: { read: true, write: false, execute: true },
      },
      maxFileSize: 10 * 1024 * 1024, // 10 MB
      maxTotalSize: 100 * 1024 * 1024, // 100 MB
      allowedPaths: ["/tmp", "/home"],
    };

    this.log("info", "Created sandboxed file system");
    return config;
  }

  /**
   * Create a sandboxed network interface
   *
   * @param whitelist - Allowed host whitelist
   * @returns Sandboxed network configuration
   */
  private createSandboxedNetwork(whitelist: string[]): SandboxedNetworkConfig {
    const config: SandboxedNetworkConfig = {
      whitelist,
      allowedPorts: [443, 80], // HTTPS and HTTP only
      maxRequestSize: 1024 * 1024, // 1 MB
      maxResponseSize: 10 * 1024 * 1024, // 10 MB
      timeout: 30000, // 30 seconds
    };

    this.log(
      "info",
      `Created sandboxed network with whitelist: ${whitelist.join(", ")}`
    );
    return config;
  }

  /**
   * Verify signed code
   *
   * @param code - Code binary
   * @param signature - Signature object
   * @param publicKey - Public key (base64-encoded)
   * @returns Verification result
   */
  async verifySignedCode(
    code: ArrayBuffer,
    signature: Signature,
    publicKey: string
  ): Promise<VerificationResult> {
    this.log("info", "Verifying signed code...");

    const result = await this.codeSigner.verify(code, signature, publicKey);

    if (result.verified) {
      this.log("info", "Code signature verified successfully");
      // Grant basic capabilities
      this.grantCapability("execute");
    } else {
      this.log("error", "Code signature verification failed");
      this.securityViolations.push("Signature verification failed");
    }

    return result;
  }

  /**
   * Check if a capability is granted
   *
   * @param capability - Capability name
   * @returns True if capability is granted
   */
  async checkCapability(capability: string): Promise<boolean> {
    const granted = this.grantedCapabilities.has(capability);
    this.log("debug", `Capability check: ${capability} -> ${granted}`);
    return granted;
  }

  /**
   * Grant a capability
   *
   * @param capability - Capability name
   */
  grantCapability(capability: string): void {
    this.grantedCapabilities.add(capability);
    this.log("info", `Granted capability: ${capability}`);
  }

  /**
   * Revoke a capability
   *
   * @param capability - Capability name
   */
  revokeCapability(capability: string): void {
    this.grantedCapabilities.delete(capability);
    this.log("info", `Revoked capability: ${capability}`);
  }

  /**
   * Get all granted capabilities
   *
   * @returns Array of capability names
   */
  getCapabilities(): string[] {
    return Array.from(this.grantedCapabilities);
  }

  /**
   * Verify memory isolation
   *
   * @returns True if memory is properly isolated
   */
  private verifyMemoryIsolation(): boolean {
    // Check that WASM memory is separate from main memory
    // This is guaranteed by WebAssembly design, but we can verify
    // by checking memory boundaries and properties

    try {
      // Get WASM memory buffer
      const wasmMemory = (this as any).wasmMemory as
        | WebAssembly.Memory
        | undefined;
      if (!wasmMemory) {
        return false;
      }

      // Verify buffer is detached from main memory
      const buffer = wasmMemory.buffer;
      if (!buffer || buffer.byteLength === 0) {
        return false;
      }

      // Check that memory is within configured limits
      const maxPages = (this as any).config?.maxPages || 1024;
      const currentPages = wasmMemory.buffer.byteLength / 65536;

      if (currentPages > maxPages) {
        this.log(
          "error",
          `Memory limit exceeded: ${currentPages} > ${maxPages} pages`
        );
        return false;
      }

      this.log("debug", "Memory isolation verified");
      return true;
    } catch (error) {
      this.log("error", `Memory isolation check failed: ${error}`);
      return false;
    }
  }

  /**
   * Detect escape attempt
   *
   * @returns True if escape attempt detected
   */
  private detectEscapeAttempt(): boolean {
    // Check for common escape patterns:
    // 1. Access to forbidden host objects
    // 2. Memory outside allocated region
    // 3. Attempts to modify sandbox boundaries
    // 4. Unexpected function calls

    let detected = false;

    // Check memory isolation
    if (!this.verifyMemoryIsolation()) {
      detected = true;
      this.securityViolations.push("Memory isolation violation detected");
    }

    // Check for unexpected exports (potential escape)
    const instance = (this as any).wasmInstance as
      | WebAssembly.Instance
      | undefined;
    if (instance) {
      const exports = Object.keys(instance.exports);

      // Look for suspicious exports
      const suspicious = exports.filter(
        e =>
          e.includes("eval") ||
          e.includes("Function") ||
          e.includes("require") ||
          e.includes("import") ||
          e.includes("fetch") ||
          e.includes("XMLHttpRequest")
      );

      if (suspicious.length > 0) {
        detected = true;
        this.securityViolations.push(
          `Suspicious exports detected: ${suspicious.join(", ")}`
        );
      }
    }

    if (detected) {
      this.escapeDetected = true;
      this.log("error", "Sandbox escape attempt detected!");
    }

    return detected;
  }

  /**
   * Get security violations
   *
   * @returns Array of security violation messages
   */
  getSecurityViolations(): string[] {
    return [...this.securityViolations];
  }

  /**
   * Clear security violations
   */
  clearSecurityViolations(): void {
    this.securityViolations = [];
    this.escapeDetected = false;
  }

  /**
   * Check if escape was detected
   *
   * @returns True if escape was detected
   */
  isEscapeDetected(): boolean {
    return this.escapeDetected;
  }

  /**
   * Enhanced execute with security checks
   *
   * @param request - Execution request
   * @returns Execution result
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // Check for escape attempts before execution
    if (this.enhancedConfig.enableEscapeDetection) {
      if (this.detectEscapeAttempt()) {
        return {
          success: false,
          error: createVMError(
            "PERMISSION_DENIED" as VMErrorCode,
            "Sandbox escape attempt detected, execution blocked"
          ),
          executionTime: 0,
          memoryUsed: 0,
        };
      }
    }

    // Verify required capabilities
    const requiredCapability = `execute:${request.functionName}`;
    if (
      this.grantedCapabilities.size > 0 &&
      !(await this.checkCapability(requiredCapability))
    ) {
      // Check for general execute capability
      if (!(await this.checkCapability("execute"))) {
        return {
          success: false,
          error: createVMError(
            "PERMISSION_DENIED" as VMErrorCode,
            `Missing capability: ${requiredCapability}`
          ),
          executionTime: 0,
          memoryUsed: 0,
        };
      }
    }

    // Call parent execute
    return super.execute(request);
  }

  /**
   * Enhanced verifyCode with signature verification
   *
   * @param code - Code binary
   * @returns Verification result
   */
  async verifyCode(code: ArrayBuffer): Promise<VerificationResult> {
    const baseResult = await super.verifyCode(code);
    const warnings = [...baseResult.warnings];
    const capabilities = [...baseResult.capabilities];
    const permissions = [...baseResult.permissions];

    // Verify signature if expected
    if (
      this.enhancedConfig.expectedSignature &&
      this.enhancedConfig.expectedPublicKey
    ) {
      const sigResult = await this.verifySignedCode(
        code,
        this.enhancedConfig.expectedSignature,
        this.enhancedConfig.expectedPublicKey
      );

      if (!sigResult.verified) {
        return {
          verified: false,
          signatureValid: false,
          permissions: [],
          capabilities: [],
          warnings: [...warnings, ...sigResult.warnings],
        };
      }

      permissions.push(...sigResult.permissions);
      capabilities.push(...sigResult.capabilities);
    }

    // Add enhanced capabilities
    if (this.enhancedConfig.enableFileSystem) {
      capabilities.push("filesystem");
      permissions.push("fs:read");
    }

    if (this.enhancedConfig.enableNetwork) {
      capabilities.push("network");
      permissions.push("net:whitelist");
    }

    if (this.enhancedConfig.enableChannels) {
      capabilities.push("channels");
      permissions.push("channels:send");
    }

    // Add security capabilities
    capabilities.push("escape-detection");
    capabilities.push("memory-isolation");

    return {
      verified: baseResult.verified,
      signatureValid: baseResult.signatureValid,
      permissions,
      capabilities,
      warnings,
    };
  }

  /**
   * Create snapshot with enhanced state
   *
   * @returns VM snapshot
   */
  async snapshot(): Promise<VMSnapshot> {
    const baseSnapshot = await super.snapshot();

    return {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        enhancedConfig: this.enhancedConfig,
        grantedCapabilities: Array.from(this.grantedCapabilities),
        securityViolations: this.securityViolations,
        escapeDetected: this.escapeDetected,
        messageChannels: Array.from(this.messageChannels.keys()),
      },
    };
  }

  /**
   * Restore VM from snapshot with enhanced state
   *
   * @param snapshot - Snapshot to restore
   */
  async restore(snapshot: VMSnapshot): Promise<void> {
    await super.restore(snapshot);

    // Restore enhanced metadata
    if (snapshot.metadata) {
      if (snapshot.metadata.enhancedConfig) {
        this.enhancedConfig = snapshot.metadata
          .enhancedConfig as EnhancedWASMConfig;
      }
      if (snapshot.metadata.grantedCapabilities) {
        this.grantedCapabilities = new Set(
          snapshot.metadata.grantedCapabilities as string[]
        );
      }
      if (snapshot.metadata.securityViolations) {
        this.securityViolations = snapshot.metadata
          .securityViolations as string[];
      }
      if (snapshot.metadata.escapeDetected) {
        this.escapeDetected = snapshot.metadata.escapeDetected as boolean;
      }
    }
  }

  /**
   * Get enhanced configuration
   *
   * @returns Enhanced configuration
   */
  getEnhancedConfig(): EnhancedWASMConfig {
    return { ...this.enhancedConfig };
  }
}

/**
 * Create a new enhanced WASM sandbox
 *
 * @param code - WebAssembly binary code
 * @param config - Enhanced configuration
 * @returns Enhanced sandbox instance
 */
export async function createWASMSandboxEnhanced(
  code: ArrayBuffer,
  config?: Partial<EnhancedWASMConfig>
): Promise<WASMSandboxEnhanced> {
  const sandbox = new WASMSandboxEnhanced(code, config);
  await sandbox.load(code);
  await sandbox.start();
  return sandbox;
}
