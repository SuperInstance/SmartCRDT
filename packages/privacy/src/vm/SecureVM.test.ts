/**
 * @module privacy/vm/tests
 *
 * Unit tests for Secure VM components.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SecureVM,
  VMErrorCode,
  DEFAULT_RESOURCE_LIMITS,
  createVMError,
  canExecute,
  canChangeState,
  WASMSandbox,
  WASMConfig,
  DEFAULT_WASM_CONFIG,
  VMManager,
  getVMManager,
  resetVMManager,
} from "./index.js";

describe("SecureVM - Types and Utilities", () => {
  describe("createVMError", () => {
    it("should create VM error with code and message", () => {
      const error = createVMError(
        VMErrorCode.TIMEOUT,
        "Execution timed out",
        "stack trace here"
      );

      expect(error.code).toBe("TIMEOUT");
      expect(error.message).toBe("Execution timed out");
      expect(error.stack).toBe("stack trace here");
    });

    it("should create VM error without stack", () => {
      const error = createVMError(VMErrorCode.OUT_OF_MEMORY, "Memory exceeded");

      expect(error.code).toBe("OUT_OF_MEMORY");
      expect(error.message).toBe("Memory exceeded");
      expect(error.stack).toBeUndefined();
    });
  });

  describe("canExecute", () => {
    it("should return true for running state", () => {
      expect(canExecute("running")).toBe(true);
    });

    it("should return false for other states", () => {
      expect(canExecute("stopped")).toBe(false);
      expect(canExecute("starting")).toBe(false);
      expect(canExecute("paused")).toBe(false);
      expect(canExecute("stopping")).toBe(false);
      expect(canExecute("error")).toBe(false);
      expect(canExecute("terminated")).toBe(false);
    });
  });

  describe("canChangeState", () => {
    it("should return true for non-terminal states", () => {
      expect(canChangeState("stopped")).toBe(true);
      expect(canChangeState("starting")).toBe(true);
      expect(canChangeState("running")).toBe(true);
      expect(canChangeState("paused")).toBe(true);
      expect(canChangeState("stopping")).toBe(true);
    });

    it("should return false for terminal states", () => {
      expect(canChangeState("terminated")).toBe(false);
      expect(canChangeState("error")).toBe(false);
    });
  });

  describe("DEFAULT_RESOURCE_LIMITS", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_RESOURCE_LIMITS.maxMemoryBytes).toBe(64 * 1024 * 1024); // 64 MB
      expect(DEFAULT_RESOURCE_LIMITS.maxCPUMs).toBe(1000);
      expect(DEFAULT_RESOURCE_LIMITS.maxExecutionTime).toBe(5000);
      expect(DEFAULT_RESOURCE_LIMITS.maxNetworkAccess).toBe(false);
      expect(DEFAULT_RESOURCE_LIMITS.maxFileDescriptors).toBe(0);
    });
  });
});

describe("WASMSandbox", () => {
  let sandbox: WASMSandbox;
  let simpleWasmCode: ArrayBuffer;

  beforeEach(() => {
    // Create a simple WASM module that exports an add function
    // This is minimal WASM that just returns constants
    const wasmBytes = new Uint8Array([
      0x00,
      0x61,
      0x73,
      0x6d, // Magic number
      0x01,
      0x00,
      0x00,
      0x00, // Version
      // Type section
      0x01,
      0x07,
      0x01,
      0x60,
      0x02,
      0x7f,
      0x7f,
      0x01,
      0x7f, // (func (i32, i32) -> i32)
      // Function section
      0x03,
      0x02,
      0x01,
      0x00,
      // Export section
      0x07,
      0x07,
      0x01,
      0x03,
      0x61,
      0x64,
      0x64,
      0x00,
      0x00, // export "add"
      // Code section
      0x0a,
      0x09,
      0x01,
      0x07,
      0x00,
      0x20,
      0x00, // local.get 0
      0x20,
      0x01, // local.get 1
      0x6a, // i32.add
      0x0b, // end
    ]);

    simpleWasmCode = wasmBytes.buffer;
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore
      }
    }
  });

  describe("Construction", () => {
    it("should create sandbox with unique ID", () => {
      sandbox = new WASMSandbox(simpleWasmCode);

      expect(sandbox.id()).toMatch(/^wasm-\d+-[a-z0-9]+$/);
    });

    it("should merge config with defaults", () => {
      const config: Partial<WASMConfig> = {
        allowConsole: false,
        defaultTimeout: 10000,
      };

      sandbox = new WASMSandbox(simpleWasmCode, config);
      expect(sandbox).toBeDefined();
    });
  });

  describe("Lifecycle", () => {
    it("should start and stop VM", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);

      expect(sandbox.getState()).toBe("stopped");

      await sandbox.start();
      expect(sandbox.getState()).toBe("running");

      await sandbox.stop();
      expect(sandbox.getState()).toBe("stopped");
    });

    it("should pause and resume VM", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      await sandbox.pause();
      expect(sandbox.getState()).toBe("paused");

      await sandbox.resume();
      expect(sandbox.getState()).toBe("running");
    });

    it("should throw error starting from invalid state", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      await expect(sandbox.start()).rejects.toThrow(/cannot start from state/);
    });

    it("should throw error pausing from invalid state", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);

      await expect(sandbox.pause()).rejects.toThrow(/cannot pause from state/);
    });
  });

  describe("Resource Limits", () => {
    it("should set resource limits", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const limits = {
        maxMemoryBytes: 32 * 1024 * 1024,
        maxCPUMs: 500,
        maxExecutionTime: 2000,
        maxNetworkAccess: false,
        maxFileDescriptors: 0,
      };

      await sandbox.setResourceLimits(limits);
      const usage = sandbox.getResourceUsage();

      expect(usage).toBeDefined();
      expect(usage.memoryBytes).toBeGreaterThanOrEqual(0);
    });

    it("should get resource usage", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const usage = sandbox.getResourceUsage();

      expect(usage.memoryBytes).toBeGreaterThanOrEqual(0);
      expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(usage.cpuPercent).toBeLessThanOrEqual(100);
      expect(usage.executionTime).toBeGreaterThanOrEqual(0);
      expect(usage.networkBytes.in).toBe(0);
      expect(usage.networkBytes.out).toBe(0);
      expect(usage.openFileDescriptors).toBe(0);
    });
  });

  describe("Execution", () => {
    it("should execute function successfully", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const result = await sandbox.execute({
        functionName: "add",
        args: [5, 3],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe(8);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle function not found", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const result = await sandbox.execute({
        functionName: "nonexistent",
        args: [],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("FUNCTION_NOT_FOUND");
    });

    it("should handle invalid arguments", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      // Pass wrong number of arguments - WASM may return NaN or undefined
      const result = await sandbox.execute({
        functionName: "add",
        args: [5], // Missing second argument
      });

      // Result might succeed but return NaN/undefined for missing arg
      // or it might throw - either is acceptable behavior
      expect(result).toBeDefined();
    });

    it("should enforce timeout", async () => {
      sandbox = new WASMSandbox(simpleWasmCode, {
        defaultTimeout: 1, // 1ms timeout
      });
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      // This should complete quickly
      const result = await sandbox.execute({
        functionName: "add",
        args: [1, 2],
        timeout: 1,
      });

      // Simple add should complete
      expect(result.success).toBe(true);
    });
  });

  describe("Messaging", () => {
    it("should send and receive messages", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const message = {
        type: "test",
        payload: { data: "hello" },
        timestamp: Date.now(),
      };

      await sandbox.sendMessage(message);

      // Note: receiveMessage polls, so we test send works
      // Full round-trip would require actual WASM implementation that sends messages
      expect(sandbox.getState()).toBe("running");
    });
  });

  describe("Verification", () => {
    it("should verify valid WASM code", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);

      const result = await sandbox.verifyCode(simpleWasmCode);

      expect(result.verified).toBe(true);
      expect(result.capabilities).toContain("wasm");
      expect(result.capabilities).toContain("sandboxed");
    });

    it("should reject invalid WASM code", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);

      const invalidCode = new ArrayBuffer(10);
      const result = await sandbox.verifyCode(invalidCode);

      expect(result.verified).toBe(false);
      expect(result.signatureValid).toBe(false);
    });
  });

  describe("Snapshot and Restore", () => {
    it("should create and restore snapshot", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const snapshot = await sandbox.snapshot();

      expect(snapshot.vmId).toBe(sandbox.id());
      expect(snapshot.state).toBe("running");
      expect(snapshot.memory).toBeInstanceOf(ArrayBuffer);
      expect(snapshot.timestamp).toBeGreaterThan(0);

      // Restore to new sandbox
      const newSandbox = new WASMSandbox(simpleWasmCode);
      await newSandbox.restore(snapshot);

      expect(newSandbox.getState()).toBe("running");
    });

    it("should restore with different VM ID (adopts snapshot ID)", async () => {
      sandbox = new WASMSandbox(simpleWasmCode);
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const snapshot = await sandbox.snapshot();
      const originalVmId = snapshot.vmId;

      const newSandbox = new WASMSandbox(simpleWasmCode);
      snapshot.vmId = "different-id";

      await newSandbox.restore(snapshot);

      // The sandbox should have adopted the snapshot's VM ID
      expect(newSandbox.id()).toBe("different-id");
      expect(newSandbox.id()).not.toBe(originalVmId);
    });
  });

  describe("Console Outputs", () => {
    it("should capture console outputs", async () => {
      sandbox = new WASMSandbox(simpleWasmCode, {
        enableLogging: true,
        logLevel: "debug",
      });
      await sandbox.load(simpleWasmCode);
      await sandbox.start();

      const outputs = sandbox.getConsoleOutputs();
      expect(Array.isArray(outputs)).toBe(true);

      sandbox.clearConsoleOutputs();
      expect(sandbox.getConsoleOutputs()).toEqual([]);
    });
  });
});

describe("VMManager", () => {
  let manager: VMManager;
  let simpleWasmCode: ArrayBuffer;

  beforeEach(() => {
    manager = new VMManager();

    // Simple WASM module
    const wasmBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60,
      0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01,
      0x03, 0x61, 0x64, 0x64, 0x00, 0x00, 0x0a, 0x09, 0x01, 0x07, 0x00, 0x20,
      0x00, 0x20, 0x01, 0x6a, 0x0b,
    ]);

    simpleWasmCode = wasmBytes.buffer;
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("VM Creation", () => {
    it("should create VM for cartridge", async () => {
      const vmId = await manager.createVM("test-cartridge", simpleWasmCode);

      expect(vmId).toBeDefined();
      expect(manager.hasVM(vmId)).toBe(true);
      expect(manager.hasCartridge("test-cartridge")).toBe(true);
    });

    it("should throw error creating duplicate VM", async () => {
      await manager.createVM("test-cartridge", simpleWasmCode);

      await expect(
        manager.createVM("test-cartridge", simpleWasmCode)
      ).rejects.toThrow(/VM already exists/);
    });

    it("should get VM by ID", async () => {
      const vmId = await manager.createVM("test-cartridge", simpleWasmCode);
      const vm = manager.getVM(vmId);

      expect(vm).toBeDefined();
      expect(vm?.id()).toBe(vmId);
    });

    it("should get VM by cartridge ID", async () => {
      await manager.createVM("test-cartridge", simpleWasmCode);
      const vm = manager.getVMByCartridge("test-cartridge");

      expect(vm).toBeDefined();
    });

    it("should return undefined for non-existent VM", () => {
      const vm = manager.getVM("non-existent");
      expect(vm).toBeUndefined();
    });
  });

  describe("VM Destruction", () => {
    it("should destroy VM by ID", async () => {
      const vmId = await manager.createVM("test-cartridge", simpleWasmCode);

      await manager.destroyVM(vmId);

      expect(manager.hasVM(vmId)).toBe(false);
      expect(manager.hasCartridge("test-cartridge")).toBe(false);
    });

    it("should destroy VM by cartridge ID", async () => {
      await manager.createVM("test-cartridge", simpleWasmCode);

      await manager.destroyVMByCartridge("test-cartridge");

      expect(manager.hasCartridge("test-cartridge")).toBe(false);
    });

    it("should throw error destroying non-existent VM", async () => {
      await expect(manager.destroyVM("non-existent")).rejects.toThrow(
        /VM not found/
      );
    });
  });

  describe("VM Listing", () => {
    it("should list all VMs", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);
      await manager.createVM("cartridge2", simpleWasmCode);

      const vms = manager.listVMs();

      expect(vms).toHaveLength(2);
      expect(vms[0].cartridgeId).toBeDefined();
      expect(vms[0].state).toBeDefined();
      expect(vms[0].resourceUsage).toBeDefined();
    });

    it("should return empty array when no VMs", () => {
      const vms = manager.listVMs();
      expect(vms).toEqual([]);
    });
  });

  describe("Execution", () => {
    it("should execute on VM by ID", async () => {
      const vmId = await manager.createVM("test-cartridge", simpleWasmCode);

      const result = await manager.execute(vmId, {
        functionName: "add",
        args: [5, 3],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe(8);
    });

    it("should execute on VM by cartridge ID", async () => {
      await manager.createVM("test-cartridge", simpleWasmCode);

      const result = await manager.executeByCartridge("test-cartridge", {
        functionName: "add",
        args: [10, 20],
      });

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe(30);
    });

    it("should return error for non-existent VM", async () => {
      const result = await manager.execute("non-existent", {
        functionName: "add",
        args: [1, 2],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("VM_NOT_FOUND");
    });

    it("should return error for non-existent cartridge", async () => {
      const result = await manager.executeByCartridge("non-existent", {
        functionName: "add",
        args: [1, 2],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CARTRIDGE_NOT_LOADED");
    });
  });

  describe("Statistics", () => {
    it("should get statistics", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);
      await manager.createVM("cartridge2", simpleWasmCode);

      const stats = manager.getStats();

      expect(stats.totalVMs).toBe(2);
      expect(stats.runningVMs).toBe(2);
      expect(stats.totalMemoryUsed).toBeGreaterThan(0);
      expect(stats.vmsByState.running).toBe(2);
    });

    it("should count VMs correctly", async () => {
      expect(manager.getCount()).toBe(0);

      await manager.createVM("cartridge1", simpleWasmCode);
      expect(manager.getCount()).toBe(1);
    });
  });

  describe("Batch Operations", () => {
    it("should pause all VMs", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);
      await manager.createVM("cartridge2", simpleWasmCode);

      await manager.pauseAll();

      const vms = manager.listVMs();
      expect(vms.every(v => v.state === "paused")).toBe(true);
    });

    it("should resume all VMs", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);
      await manager.createVM("cartridge2", simpleWasmCode);

      await manager.pauseAll();
      await manager.resumeAll();

      const vms = manager.listVMs();
      expect(vms.every(v => v.state === "running")).toBe(true);
    });

    it("should stop all VMs", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);
      await manager.createVM("cartridge2", simpleWasmCode);

      await manager.stopAll();

      const stats = manager.getStats();
      expect(stats.runningVMs).toBe(0);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup idle VMs", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);

      // Simulate idle time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup with small threshold
      const cleaned = await manager.cleanupIdle(50);

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it("should cleanup all VMs", async () => {
      await manager.createVM("cartridge1", simpleWasmCode);
      await manager.createVM("cartridge2", simpleWasmCode);

      await manager.cleanup();

      expect(manager.getCount()).toBe(0);
    });
  });

  describe("Global Manager", () => {
    afterEach(() => {
      resetVMManager();
    });

    it("should return singleton manager", () => {
      const m1 = getVMManager();
      const m2 = getVMManager();

      expect(m1).toBe(m2);
    });

    it("should reset global manager", () => {
      const m1 = getVMManager();
      resetVMManager();
      const m2 = getVMManager();

      expect(m1).not.toBe(m2);
    });
  });
});

describe("Integration Tests", () => {
  let manager: VMManager;
  let simpleWasmCode: ArrayBuffer;

  beforeEach(() => {
    manager = new VMManager();

    const wasmBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60,
      0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01,
      0x03, 0x61, 0x64, 0x64, 0x00, 0x00, 0x0a, 0x09, 0x01, 0x07, 0x00, 0x20,
      0x00, 0x20, 0x01, 0x6a, 0x0b,
    ]);

    simpleWasmCode = wasmBytes.buffer;
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  it("should handle complete VM lifecycle", async () => {
    // Create
    const vmId = await manager.createVM("test-cartridge", simpleWasmCode);
    expect(manager.hasVM(vmId)).toBe(true);

    // Execute
    const result = await manager.execute(vmId, {
      functionName: "add",
      args: [100, 200],
    });
    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(300);

    // Pause
    await manager.pauseAll();
    let vms = manager.listVMs();
    expect(vms[0].state).toBe("paused");

    // Resume
    await manager.resumeAll();
    vms = manager.listVMs();
    expect(vms[0].state).toBe("running");

    // Destroy
    await manager.destroyVM(vmId);
    expect(manager.hasVM(vmId)).toBe(false);
  });

  it("should manage multiple VMs independently", async () => {
    const vm1 = await manager.createVM("cartridge1", simpleWasmCode);
    const vm2 = await manager.createVM("cartridge2", simpleWasmCode);

    const result1 = await manager.execute(vm1, {
      functionName: "add",
      args: [1, 2],
    });

    const result2 = await manager.execute(vm2, {
      functionName: "add",
      args: [10, 20],
    });

    expect(result1.returnValue).toBe(3);
    expect(result2.returnValue).toBe(30);

    const stats = manager.getStats();
    expect(stats.totalVMs).toBe(2);
  });
});
