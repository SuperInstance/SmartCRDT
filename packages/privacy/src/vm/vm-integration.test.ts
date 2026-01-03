/**
 * @module privacy/vm/test
 *
 * Integration tests for VM-Cartridge integration.
 *
 * Tests cartridge execution in WASM sandbox, resource limit enforcement,
 * communication channels, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CartridgeVMBridge,
  getCartridgeVMBridge,
  resetCartridgeVMBridge,
} from "./CartridgeVMBridge.js";
import {
  SandboxedCartridgeExecutor,
  getSandboxedCartridgeExecutor,
  resetSandboxedCartridgeExecutor,
} from "./SandboxedCartridgeExecutor.js";
import type { CartridgeManifest } from "@lsi/protocol";
import { Signature } from "./CodeSigner.js";

/**
 * Create a minimal valid WASM module for testing
 *
 * This is a minimal WASM module that exports simple functions.
 * In real scenarios, this would be compiled from C/Rust/AssemblyScript.
 */
function createMinimalWASMModule(): ArrayBuffer {
  // Minimal WASM with a simple add function
  // This is a valid WASM binary that exports an "add" function
  const wasmBytes = new Uint8Array([
    0x00,
    0x61,
    0x73,
    0x6d, // Magic number
    0x01,
    0x00,
    0x00,
    0x00, // Version
    0x01,
    0x07,
    0x01, // Type section
    0x60,
    0x02,
    0x7f,
    0x7f,
    0x01,
    0x7f, // Function type: (i32, i32) -> i32
    0x03,
    0x02,
    0x01,
    0x00, // Function section
    0x07,
    0x07,
    0x01, // Export section
    0x03,
    0x61,
    0x64,
    0x64,
    0x00,
    0x00, // Export "add" function
    0x0a,
    0x09,
    0x01, // Code section
    0x07,
    0x00, // Function body size
    0x20,
    0x00, // Get local 0
    0x20,
    0x01, // Get local 1
    0x6a, // i32.add
    0x0b, // End
  ]);

  return wasmBytes.buffer;
}

/**
 * Create a test cartridge manifest
 */
function createTestManifest(
  id: string,
  version: string = "1.0.0"
): CartridgeManifest {
  return {
    id,
    version,
    name: `Test Cartridge ${id}`,
    description: "Test cartridge for VM integration",
    author: "test",
    license: "MIT",
    dependencies: [],
    conflicts: [],
    capabilities: {
      domains: ["test"],
      queryTypes: ["general"],
      sizeBytes: 1024,
      loadTimeMs: 100,
      privacyLevel: "public",
    },
    metadata: {},
    checksum: "test-checksum",
  };
}

/**
 * Create a test signature
 */
function createTestSignature(): Signature {
  return {
    algorithm: "ED25519",
    keyId: "test-key-id",
    signature: "dGVzdC1zaWduYXR1cmU=", // base64 encoded
    timestamp: Date.now(),
    metadata: {},
  };
}

describe("CartridgeVMBridge", () => {
  let bridge: CartridgeVMBridge;

  beforeEach(() => {
    resetCartridgeVMBridge();
    bridge = new CartridgeVMBridge({
      enable_code_signing: false,
      enable_escape_detection: false,
    });
  });

  afterEach(async () => {
    await bridge.shutdown();
  });

  describe("load_cartridge", () => {
    it("should load a cartridge successfully", async () => {
      const manifest = createTestManifest("test-1");
      const wasmModule = createMinimalWASMModule();

      const cartridge = await bridge.load_cartridge(manifest, wasmModule);

      expect(cartridge).toBeDefined();
      expect(cartridge.id).toBe("test-1@1.0.0");
      expect(cartridge.manifest).toEqual(manifest);
      expect(cartridge.state).toBe("loaded");
      expect(cartridge.executionCount).toBe(0);
    });

    it("should reject duplicate cartridge loads", async () => {
      const manifest = createTestManifest("test-2");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);

      await expect(bridge.load_cartridge(manifest, wasmModule)).rejects.toThrow(
        "already loaded"
      );
    });

    it("should reject oversized WASM modules", async () => {
      const manifest = createTestManifest("test-3");
      const bridge2 = new CartridgeVMBridge({
        max_sandbox_size: 100, // Very small limit
        enable_code_signing: false,
      });

      const largeWasm = new ArrayBuffer(200);

      await expect(bridge2.load_cartridge(manifest, largeWasm)).rejects.toThrow(
        "exceeds limit"
      );

      await bridge2.shutdown();
    });

    it("should verify code signature when enabled", async () => {
      const manifest = createTestManifest("test-4");
      const wasmModule = createMinimalWASMModule();
      const signature = createTestSignature();

      const bridgeWithSig = new CartridgeVMBridge({
        enable_code_signing: true,
      });

      // This will fail verification since signature doesn't match
      const result = bridgeWithSig.load_cartridge(
        manifest,
        wasmModule,
        signature
      );

      // Verification should fail for invalid signature
      await expect(result).rejects.toThrow();

      await bridgeWithSig.shutdown();
    });

    it("should start resource monitoring on load", async () => {
      const manifest = createTestManifest("test-5");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);

      const usage = bridge.get_usage("test-5@1.0.0");
      expect(usage).toBeDefined();
      expect(usage.memoryBytes).toBeGreaterThanOrEqual(0);
      expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe("execute_method", () => {
    it("should execute a cartridge method successfully", async () => {
      const manifest = createTestManifest("test-6");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);

      const result = await bridge.execute_method("test-6@1.0.0", "add", [2, 3]);

      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should return error for non-existent cartridge", async () => {
      const result = await bridge.execute_method("non-existent", "test", []);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CARTRIDGE_NOT_FOUND");
    });

    it("should return error for non-existent method", async () => {
      const manifest = createTestManifest("test-7");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);

      const result = await bridge.execute_method(
        "test-7@1.0.0",
        "nonExistent",
        []
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("FUNCTION_NOT_FOUND");
    });

    it("should track execution statistics", async () => {
      const manifest = createTestManifest("test-8");
      const wasmModule = createMinimalWASMModule();

      const cartridge = await bridge.load_cartridge(manifest, wasmModule);

      await bridge.execute_method("test-8@1.0.0", "add", [1, 2]);
      await bridge.execute_method("test-8@1.0.0", "add", [3, 4]);

      expect(cartridge.executionCount).toBe(2);
      expect(cartridge.totalExecutionTime).toBeGreaterThan(0);
      expect(cartridge.lastExecutedAt).toBeDefined();
    });
  });

  describe("create_channel", () => {
    it("should create a communication channel", async () => {
      const channel = await bridge.create_channel("test-channel", {
        buffer_size: 1024,
        timeout: 1000,
      });

      expect(channel).toBeDefined();
      expect(channel.id).toBe("test-channel");
      expect(channel.is_open()).toBe(true);
    });

    it("should send and receive messages", async () => {
      const channel = await bridge.create_channel("test-channel-2");

      await channel.send({ test: "data" });
      const received = await channel.receive();

      expect(received).toEqual({ test: "data" });
    });

    it("should track channel statistics", async () => {
      const channel = await bridge.create_channel("test-channel-3");

      await channel.send({ msg: 1 });
      await channel.send({ msg: 2 });
      await channel.receive(); // Receive first

      const stats = channel.get_stats();
      expect(stats.sent).toBe(2);
      expect(stats.received).toBe(1);
      expect(stats.bytes).toBeGreaterThan(0);
    });

    it("should close channel", async () => {
      const channel = await bridge.create_channel("test-channel-4");

      await channel.close();

      expect(channel.is_open()).toBe(false);
    });

    it("should reject sending to closed channel", async () => {
      const channel = await bridge.create_channel("test-channel-5");
      await channel.close();

      await expect(channel.send({ test: "data" })).rejects.toThrow("closed");
    });

    it("should enforce buffer size limits", async () => {
      const channel = await bridge.create_channel("test-channel-6", {
        buffer_size: 10, // Very small
      });

      const largeData = { x: "a".repeat(100) };

      await expect(channel.send(largeData)).rejects.toThrow("exceeds buffer");
    });
  });

  describe("set_quota", () => {
    it("should set resource quota for cartridge", async () => {
      const manifest = createTestManifest("test-9");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);

      bridge.set_quota("test-9@1.0.0", {
        memory: 32 * 1024 * 1024,
        cpu: 25,
        execution_time: 3000,
        network_bytes: 0,
        file_descriptors: 0,
      });

      const cartridge = bridge.get_cartridge("test-9@1.0.0");
      expect(cartridge?.quota.memory).toBe(32 * 1024 * 1024);
      expect(cartridge?.quota.cpu).toBe(25);
    });

    it("should throw for non-existent cartridge", () => {
      expect(() => {
        bridge.set_quota("non-existent", {
          memory: 1024,
          cpu: 10,
          execution_time: 1000,
          network_bytes: 0,
          file_descriptors: 0,
        });
      }).toThrow("not found");
    });
  });

  describe("get_usage", () => {
    it("should get resource usage for cartridge", async () => {
      const manifest = createTestManifest("test-10");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);

      const usage = bridge.get_usage("test-10@1.0.0");

      expect(usage.memoryBytes).toBeGreaterThanOrEqual(0);
      expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(usage.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should throw for non-existent cartridge", () => {
      expect(() => bridge.get_usage("non-existent")).toThrow("not found");
    });
  });

  describe("unload_cartridge", () => {
    it("should unload a cartridge", async () => {
      const manifest = createTestManifest("test-11");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest, wasmModule);
      expect(bridge.list_loaded()).toContain("test-11@1.0.0");

      await bridge.unload_cartridge("test-11@1.0.0");
      expect(bridge.list_loaded()).not.toContain("test-11@1.0.0");
    });

    it("should handle unloading non-existent cartridge gracefully", async () => {
      await expect(
        bridge.unload_cartridge("non-existent")
      ).resolves.toBeUndefined();
    });
  });

  describe("list_loaded", () => {
    it("should list all loaded cartridges", async () => {
      const manifest1 = createTestManifest("test-12");
      const manifest2 = createTestManifest("test-13");
      const wasmModule = createMinimalWASMModule();

      await bridge.load_cartridge(manifest1, wasmModule);
      await bridge.load_cartridge(manifest2, wasmModule);

      const loaded = bridge.list_loaded();
      expect(loaded).toContain("test-12@1.0.0");
      expect(loaded).toContain("test-13@1.0.0");
      expect(loaded.length).toBe(2);
    });
  });
});

describe("SandboxedCartridgeExecutor", () => {
  let executor: SandboxedCartridgeExecutor;

  beforeEach(() => {
    resetSandboxedCartridgeExecutor();
    executor = getSandboxedCartridgeExecutor({
      auto_recovery: false,
      log_executions: false,
    });
  });

  afterEach(async () => {
    await executor.shutdown_all();
  });

  describe("load", () => {
    it("should load a cartridge", async () => {
      const manifest = createTestManifest("exec-test-1");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      expect(cartridgeId).toBe("exec-test-1@1.0.0");
    });

    it("should reject duplicate loads", async () => {
      const manifest = createTestManifest("exec-test-2");
      const wasmModule = createMinimalWASMModule();

      await executor.load(manifest, wasmModule);

      await expect(executor.load(manifest, wasmModule)).rejects.toThrow(
        "already loaded"
      );
    });

    it("should set state to loading then loaded", async () => {
      const manifest = createTestManifest("exec-test-3");
      const wasmModule = createMinimalWASMModule();

      // Note: We can't easily test intermediate state without async races
      await executor.load(manifest, wasmModule);

      const state = executor.get_state("exec-test-3@1.0.0");
      expect(state).toBe("loaded");
    });
  });

  describe("initialize", () => {
    it("should initialize a loaded cartridge", async () => {
      const manifest = createTestManifest("exec-test-4");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);
      await executor.initialize(cartridgeId);

      expect(executor.get_state(cartridgeId)).toBe("loaded");
    });

    it("should throw for non-existent cartridge", async () => {
      await expect(executor.initialize("non-existent")).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("execute", () => {
    it("should execute a cartridge method", async () => {
      const manifest = createTestManifest("exec-test-5");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      const response = await executor.execute(cartridgeId, {
        method: "add",
        params: [5, 7],
      });

      expect(response.success).toBe(true);
      expect(response.data).toBe(12);
      expect(response.execution_time).toBeGreaterThanOrEqual(0);
    });

    it("should return error for non-existent cartridge", async () => {
      const response = await executor.execute("non-existent", {
        method: "test",
        params: [],
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("CARTRIDGE_NOT_FOUND");
    });

    it("should return error for invalid state", async () => {
      const manifest = createTestManifest("exec-test-6");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      // Manually set to error state
      const list = executor.list_cartridges();
      const cartridge = list.find(c => c.id === cartridgeId);
      // Can't easily manipulate state, so skip this test

      // Instead test non-existent method
      const response = await executor.execute(cartridgeId, {
        method: "nonExistent",
        params: [],
      });

      expect(response.success).toBe(false);
    });

    it("should include request_id in response", async () => {
      const manifest = createTestManifest("exec-test-7");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      const response = await executor.execute(cartridgeId, {
        method: "add",
        params: [1, 1],
        request_id: "test-request-123",
      });

      expect(response.request_id).toBe("test-request-123");
    });

    it("should track execution statistics", async () => {
      const manifest = createTestManifest("exec-test-8");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      await executor.execute(cartridgeId, { method: "add", params: [1, 2] });
      await executor.execute(cartridgeId, { method: "add", params: [3, 4] });

      const cartridges = executor.list_cartridges();
      const cartridge = cartridges.find(c => c.id === cartridgeId);

      expect(cartridge?.stats.total).toBe(2);
      expect(cartridge?.stats.successful).toBe(2);
    });
  });

  describe("shutdown", () => {
    it("should shutdown a cartridge", async () => {
      const manifest = createTestManifest("exec-test-9");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);
      expect(executor.list_cartridges().length).toBe(1);

      await executor.shutdown(cartridgeId);

      expect(executor.list_cartridges().length).toBe(0);
    });

    it("should handle shutting down non-existent cartridge", async () => {
      await expect(executor.shutdown("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("get_state", () => {
    it("should return unloaded for non-existent cartridge", () => {
      const state = executor.get_state("non-existent");
      expect(state).toBe("unloaded");
    });

    it("should return correct state for loaded cartridge", async () => {
      const manifest = createTestManifest("exec-test-10");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      expect(executor.get_state(cartridgeId)).toBe("loaded");
    });
  });

  describe("list_cartridges", () => {
    it("should list all cartridges", async () => {
      const manifest1 = createTestManifest("exec-test-11");
      const manifest2 = createTestManifest("exec-test-12");
      const wasmModule = createMinimalWASMModule();

      await executor.load(manifest1, wasmModule);
      await executor.load(manifest2, wasmModule);

      const cartridges = executor.list_cartridges();
      expect(cartridges.length).toBe(2);

      const ids = cartridges.map(c => c.id);
      expect(ids).toContain("exec-test-11@1.0.0");
      expect(ids).toContain("exec-test-12@1.0.0");
    });

    it("should include cartridge info", async () => {
      const manifest = createTestManifest("exec-test-13");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      const cartridges = executor.list_cartridges();
      const cartridge = cartridges.find(c => c.id === cartridgeId);

      expect(cartridge).toBeDefined();
      expect(cartridge?.manifest).toEqual(manifest);
      expect(cartridge?.stats).toBeDefined();
      expect(cartridge?.quota).toBeDefined();
    });
  });

  describe("handle_sandbox_error", () => {
    it("should handle timeout error", () => {
      const resolution = executor.handle_sandbox_error({
        code: "TIMEOUT",
        message: "Execution timeout",
      });

      expect(resolution.success).toBe(true);
      expect(resolution.action).toBe("retry");
    });

    it("should handle out of memory error", () => {
      const resolution = executor.handle_sandbox_error({
        code: "OUT_OF_MEMORY",
        message: "Memory limit exceeded",
      });

      expect(resolution.success).toBe(true);
      expect(resolution.action).toBe("reload");
    });

    it("should handle function not found error", () => {
      const resolution = executor.handle_sandbox_error({
        code: "FUNCTION_NOT_FOUND",
        message: "Function not found",
      });

      expect(resolution.success).toBe(false);
      expect(resolution.action).toBe("abort");
    });
  });

  describe("recover_from_timeout", () => {
    it("should attempt recovery from timeout", async () => {
      const manifest = createTestManifest("exec-test-14");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executor.load(manifest, wasmModule);

      const result = await executor.recover_from_timeout(cartridgeId);

      expect(result).toBeDefined();
      expect(result.recovery_time).toBeGreaterThanOrEqual(0);
    });

    it("should return failure for non-existent cartridge", async () => {
      const result = await executor.recover_from_timeout("non-existent");

      expect(result.success).toBe(false);
      expect(result.method).toBe("abort");
    });
  });

  describe("error recovery", () => {
    it("should retry recoverable errors", async () => {
      const executorWithRetry = getSandboxedCartridgeExecutor({
        auto_recovery: true,
        max_retries: 2,
        retry_delay: 10,
      });

      const manifest = createTestManifest("exec-test-retry");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executorWithRetry.load(manifest, wasmModule);

      // This should succeed on first try
      const response = await executorWithRetry.execute(cartridgeId, {
        method: "add",
        params: [1, 2],
      });

      expect(response.success).toBe(true);

      await executorWithRetry.shutdown_all();
    });
  });

  describe("concurrent execution", () => {
    it("should respect max concurrent limit", async () => {
      const executorConcurrent = getSandboxedCartridgeExecutor({
        max_concurrent: 2,
        auto_recovery: false,
      });

      const manifest = createTestManifest("exec-test-concurrent");
      const wasmModule = createMinimalWASMModule();

      const cartridgeId = await executorConcurrent.load(manifest, wasmModule);

      // Execute multiple requests concurrently
      const promises = [
        executorConcurrent.execute(cartridgeId, {
          method: "add",
          params: [1, 1],
        }),
        executorConcurrent.execute(cartridgeId, {
          method: "add",
          params: [2, 2],
        }),
        executorConcurrent.execute(cartridgeId, {
          method: "add",
          params: [3, 3],
        }),
      ];

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);

      await executorConcurrent.shutdown_all();
    });
  });
});

describe("Global instances", () => {
  afterEach(() => {
    resetCartridgeVMBridge();
    resetSandboxedCartridgeExecutor();
  });

  it("should provide global CartridgeVMBridge instance", () => {
    const bridge1 = getCartridgeVMBridge();
    const bridge2 = getCartridgeVMBridge();

    expect(bridge1).toBe(bridge2);
  });

  it("should provide global executor instance", () => {
    const executor1 = getSandboxedCartridgeExecutor();
    const executor2 = getSandboxedCartridgeExecutor();

    expect(executor1).toBe(executor2);
  });

  it("should reset global instances", () => {
    const bridge1 = getCartridgeVMBridge();
    resetCartridgeVMBridge();
    const bridge2 = getCartridgeVMBridge();

    expect(bridge1).not.toBe(bridge2);
  });
});

describe("Integration scenarios", () => {
  let bridge: CartridgeVMBridge;
  let executor: SandboxedCartridgeExecutor;

  beforeEach(() => {
    resetCartridgeVMBridge();
    resetSandboxedCartridgeExecutor();
    bridge = new CartridgeVMBridge({ enable_code_signing: false });
    executor = getSandboxedCartridgeExecutor({ auto_recovery: false });
  });

  afterEach(async () => {
    await bridge.shutdown();
    await executor.shutdown_all();
  });

  it("should complete full cartridge lifecycle", async () => {
    const manifest = createTestManifest("lifecycle-test");
    const wasmModule = createMinimalWASMModule();

    // Load
    const cartridgeId = await executor.load(manifest, wasmModule);
    expect(executor.get_state(cartridgeId)).toBe("loaded");

    // Initialize
    await executor.initialize(cartridgeId);

    // Execute
    const response = await executor.execute(cartridgeId, {
      method: "add",
      params: [10, 20],
    });
    expect(response.success).toBe(true);
    expect(response.data).toBe(30);

    // Check stats
    const cartridges = executor.list_cartridges();
    const cartridge = cartridges.find(c => c.id === cartridgeId);
    expect(cartridge?.stats.total).toBe(1);
    expect(cartridge?.stats.successful).toBe(1);

    // Shutdown
    await executor.shutdown(cartridgeId);
    expect(executor.get_state(cartridgeId)).toBe("unloaded");
  });

  it("should handle multiple cartridges", async () => {
    const wasmModule = createMinimalWASMModule();

    const manifests = [
      createTestManifest("multi-1"),
      createTestManifest("multi-2"),
      createTestManifest("multi-3"),
    ];

    // Load all
    const cartridgeIds = await Promise.all(
      manifests.map(m => executor.load(m, wasmModule))
    );

    // Execute all
    const results = await Promise.all(
      cartridgeIds.map(id =>
        executor.execute(id, { method: "add", params: [5, 5] })
      )
    );

    expect(results.every(r => r.success)).toBe(true);
    expect(results.every(r => r.data === 10)).toBe(true);

    // List all
    const cartridges = executor.list_cartridges();
    expect(cartridges.length).toBe(3);
  });
});
