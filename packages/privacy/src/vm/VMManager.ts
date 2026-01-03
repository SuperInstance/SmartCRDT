/**
 * @module privacy/vm
 *
 * VM lifecycle manager for managing multiple secure VMs.
 */

import type {
  SecureVM,
  ResourceLimits,
  ExecutionRequest,
  ExecutionResult,
  ResourceUsage,
  VMState,
} from "./SecureVM.js";
import { DEFAULT_RESOURCE_LIMITS } from "./SecureVM.js";
import { WASMSandbox, WASMConfig } from "./WASMSandbox.js";

/**
 * Configuration for VM creation
 */
export interface SecureVMConfig {
  /** Memory limits */
  initialMemoryPages?: number;
  maxMemoryPages?: number;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Maximum timeout in milliseconds */
  maxTimeout?: number;
  /** Capabilities */
  allowConsole?: boolean;
  allowTimer?: boolean;
  allowNetwork?: boolean;
  allowFileSystem?: boolean;
  /** Security */
  verifySignature?: boolean;
  /** Enable logging */
  enableLogging?: boolean;
  /** Resource limits (optional) */
  limits?: Partial<ResourceLimits>;
}

/**
 * Information about a VM
 */
export interface VMInfo {
  /** Unique VM identifier */
  vmId: string;
  /** Cartridge identifier */
  cartridgeId: string;
  /** Current VM state */
  state: VMState;
  /** Current resource usage */
  resourceUsage: ResourceUsage;
  /** Creation timestamp (Unix epoch) */
  createdAt: number;
  /** Last activity timestamp (Unix epoch) */
  lastActivityAt: number;
}

/**
 * VM manager statistics
 */
export interface VMManagerStats {
  /** Total number of VMs */
  totalVMs: number;
  /** Number of running VMs */
  runningVMs: number;
  /** Total memory used across all VMs (bytes) */
  totalMemoryUsed: number;
  /** Total CPU used across all VMs (percent) */
  totalCPUUsed: number;
  /** Number of VMs in each state */
  vmsByState: Record<VMState, number>;
}

/**
 * VM creation options
 */
export interface CreateVMOptions {
  /** Cartridge identifier */
  cartridgeId: string;
  /** VM code (WebAssembly binary) */
  code: ArrayBuffer;
  /** VM configuration */
  config?: SecureVMConfig;
  /** Resource limits */
  limits?: Partial<ResourceLimits>;
}

/**
 * VM Manager
 *
 * Manages lifecycle of multiple secure VMs.
 * Provides creation, discovery, execution, and cleanup of VMs.
 */
export class VMManager {
  private vms = new Map<string, SecureVM>();
  private cartridgeMap = new Map<string, string>(); // cartridgeId -> vmId
  private creationTimes = new Map<string, number>();
  private lastActivity = new Map<string, number>();
  private vmCount = 0;

  constructor() {
    // VM manager initialized
  }

  /**
   * Create a new VM
   *
   * @param cartridgeId - Cartridge identifier
   * @param code - WebAssembly binary code
   * @param config - Optional VM configuration
   * @returns VM identifier
   */
  async createVM(
    cartridgeId: string,
    code: ArrayBuffer,
    config?: SecureVMConfig
  ): Promise<string> {
    // Check if cartridge already has a VM
    if (this.cartridgeMap.has(cartridgeId)) {
      const existingVmId = this.cartridgeMap.get(cartridgeId)!;
      const existingVM = this.vms.get(existingVmId);
      if (
        existingVM &&
        existingVM.getState() !== "terminated" &&
        existingVM.getState() !== "stopped"
      ) {
        throw new Error(`VM already exists for cartridge: ${cartridgeId}`);
      }
    }

    // Create WASM sandbox
    const sandbox = new WASMSandbox(code, config);

    // Apply resource limits if provided
    if (config?.limits) {
      const limits = { ...DEFAULT_RESOURCE_LIMITS, ...config.limits };
      await sandbox.setResourceLimits(limits);
    }

    // Load and start the VM
    await sandbox.load(code);
    await sandbox.start();

    const vmId = sandbox.id();

    // Register VM
    this.vms.set(vmId, sandbox);
    this.cartridgeMap.set(cartridgeId, vmId);
    this.creationTimes.set(vmId, Date.now());
    this.lastActivity.set(vmId, Date.now());
    this.vmCount++;

    return vmId;
  }

  /**
   * Get VM by ID
   *
   * @param vmId - VM identifier
   * @returns VM or undefined if not found
   */
  getVM(vmId: string): SecureVM | undefined {
    return this.vms.get(vmId);
  }

  /**
   * Get VM by cartridge ID
   *
   * @param cartridgeId - Cartridge identifier
   * @returns VM or undefined if not found
   */
  getVMByCartridge(cartridgeId: string): SecureVM | undefined {
    const vmId = this.cartridgeMap.get(cartridgeId);
    return vmId ? this.vms.get(vmId) : undefined;
  }

  /**
   * Destroy a VM
   *
   * @param vmId - VM identifier
   */
  async destroyVM(vmId: string): Promise<void> {
    const vm = this.vms.get(vmId);
    if (!vm) {
      throw new Error(`VM not found: ${vmId}`);
    }

    // Stop the VM
    try {
      await vm.stop();
    } catch (error) {
      // Ignore errors if VM already stopped
    }

    // Remove from maps
    this.vms.delete(vmId);

    // Remove cartridge mapping
    for (const [cartridgeId, mappedVmId] of Array.from(
      this.cartridgeMap.entries()
    )) {
      if (mappedVmId === vmId) {
        this.cartridgeMap.delete(cartridgeId);
        break;
      }
    }

    this.creationTimes.delete(vmId);
    this.lastActivity.delete(vmId);
    this.vmCount--;
  }

  /**
   * Destroy VM by cartridge ID
   *
   * @param cartridgeId - Cartridge identifier
   */
  async destroyVMByCartridge(cartridgeId: string): Promise<void> {
    const vmId = this.cartridgeMap.get(cartridgeId);
    if (vmId) {
      await this.destroyVM(vmId);
    }
  }

  /**
   * List all VMs
   *
   * @returns Array of VM information
   */
  listVMs(): VMInfo[] {
    const infos: VMInfo[] = [];

    for (const [vmId, vm] of Array.from(this.vms.entries())) {
      const cartridgeId = this.getCartridgeId(vmId);
      infos.push({
        vmId,
        cartridgeId: cartridgeId || "unknown",
        state: vm.getState(),
        resourceUsage: vm.getResourceUsage(),
        createdAt: this.creationTimes.get(vmId) || 0,
        lastActivityAt: this.lastActivity.get(vmId) || 0,
      });
    }

    return infos;
  }

  /**
   * Get cartridge ID for VM
   */
  private getCartridgeId(vmId: string): string | undefined {
    for (const [cartridgeId, mappedVmId] of Array.from(
      this.cartridgeMap.entries()
    )) {
      if (mappedVmId === vmId) {
        return cartridgeId;
      }
    }
    return undefined;
  }

  /**
   * Execute function on VM
   *
   * @param vmId - VM identifier
   * @param request - Execution request
   * @returns Execution result
   */
  async execute(
    vmId: string,
    request: ExecutionRequest
  ): Promise<ExecutionResult> {
    const vm = this.vms.get(vmId);
    if (!vm) {
      return {
        success: false,
        error: {
          code: "VM_NOT_FOUND",
          message: `VM not found: ${vmId}`,
        },
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    // Update last activity
    this.lastActivity.set(vmId, Date.now());

    return vm.execute(request);
  }

  /**
   * Execute function on VM by cartridge ID
   *
   * @param cartridgeId - Cartridge identifier
   * @param request - Execution request
   * @returns Execution result
   */
  async executeByCartridge(
    cartridgeId: string,
    request: ExecutionRequest
  ): Promise<ExecutionResult> {
    const vmId = this.cartridgeMap.get(cartridgeId);
    if (!vmId) {
      return {
        success: false,
        error: {
          code: "CARTRIDGE_NOT_LOADED",
          message: `No VM loaded for cartridge: ${cartridgeId}`,
        },
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    return this.execute(vmId, request);
  }

  /**
   * Get aggregate statistics
   *
   * @returns VM manager statistics
   */
  getStats(): VMManagerStats {
    const stats: VMManagerStats = {
      totalVMs: this.vms.size,
      runningVMs: 0,
      totalMemoryUsed: 0,
      totalCPUUsed: 0,
      vmsByState: {
        stopped: 0,
        starting: 0,
        running: 0,
        paused: 0,
        stopping: 0,
        error: 0,
        terminated: 0,
      },
    };

    for (const vm of Array.from(this.vms.values())) {
      const state = vm.getState();
      const usage = vm.getResourceUsage();

      stats.vmsByState[state]++;
      stats.totalMemoryUsed += usage.memoryBytes;
      stats.totalCPUUsed += usage.cpuPercent;

      if (state === "running") {
        stats.runningVMs++;
      }
    }

    return stats;
  }

  /**
   * Pause all running VMs
   */
  async pauseAll(): Promise<void> {
    const pausePromises: Promise<void>[] = [];

    for (const vm of Array.from(this.vms.values())) {
      if (vm.getState() === "running") {
        pausePromises.push(vm.pause());
      }
    }

    await Promise.all(pausePromises);
  }

  /**
   * Resume all paused VMs
   */
  async resumeAll(): Promise<void> {
    const resumePromises: Promise<void>[] = [];

    for (const vm of Array.from(this.vms.values())) {
      if (vm.getState() === "paused") {
        resumePromises.push(vm.resume());
      }
    }

    await Promise.all(resumePromises);
  }

  /**
   * Stop all VMs
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const vm of Array.from(this.vms.values())) {
      if (vm.getState() === "running" || vm.getState() === "paused") {
        stopPromises.push(vm.stop().catch(() => {})); // Ignore errors
      }
    }

    await Promise.all(stopPromises);
  }

  /**
   * Clean up idle VMs (inactive for specified duration)
   *
   * @param idleTimeMs - Idle time threshold in milliseconds
   * @returns Number of VMs cleaned up
   */
  async cleanupIdle(idleTimeMs: number): Promise<number> {
    const now = Date.now();
    const toDestroy: string[] = [];

    for (const [vmId, lastActivity] of Array.from(
      this.lastActivity.entries()
    )) {
      if (now - lastActivity > idleTimeMs) {
        const vm = this.vms.get(vmId);
        if (vm && vm.getState() === "running") {
          toDestroy.push(vmId);
        }
      }
    }

    for (const vmId of toDestroy) {
      await this.destroyVM(vmId).catch(() => {}); // Ignore errors
    }

    return toDestroy.length;
  }

  /**
   * Clean up all VMs
   */
  async cleanup(): Promise<void> {
    await this.stopAll();

    const destroyPromises: Promise<void>[] = [];
    for (const vmId of Array.from(this.vms.keys())) {
      destroyPromises.push(this.destroyVM(vmId).catch(() => {})); // Ignore errors
    }

    await Promise.all(destroyPromises);
  }

  /**
   * Get number of VMs
   */
  getCount(): number {
    return this.vms.size;
  }

  /**
   * Check if VM exists
   */
  hasVM(vmId: string): boolean {
    return this.vms.has(vmId);
  }

  /**
   * Check if cartridge has VM loaded
   */
  hasCartridge(cartridgeId: string): boolean {
    return this.cartridgeMap.has(cartridgeId);
  }
}

/**
 * Global VM manager singleton
 */
let globalVMManager: VMManager | undefined;

/**
 * Get or create global VM manager
 */
export function getVMManager(): VMManager {
  if (!globalVMManager) {
    globalVMManager = new VMManager();
  }
  return globalVMManager;
}

/**
 * Reset global VM manager (for testing)
 */
export function resetVMManager(): void {
  if (globalVMManager) {
    globalVMManager.cleanup().catch(() => {});
    globalVMManager = undefined;
  }
}
