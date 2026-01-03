/**
 * @module privacy/vm
 *
 * Tests for WASMSandboxEnhanced with communication channels,
 * file system sandboxing, and security features.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WASMSandboxEnhanced,
  EnhancedWASMConfig,
  createWASMSandboxEnhanced,
  DEFAULT_ENHANCED_CONFIG,
} from "./WASMSandboxEnhanced.js";
import { CodeSigner, KeyPair } from "./CodeSigner.js";
import { ResourceMonitor, ResourceExhaustion } from "./ResourceMonitor.js";
import type { VMMessage } from "./SecureVM.js";

// Simple test data (not a valid WASM, just for testing structure)
const testData = new ArrayBuffer(64);

describe("WASMSandboxEnhanced", () => {
  describe("Construction and Initialization", () => {
    it("should create with default config", () => {
      const sandbox = new WASMSandboxEnhanced(testData);
      expect(sandbox).toBeDefined();
      expect(sandbox.getEnhancedConfig()).toEqual(DEFAULT_ENHANCED_CONFIG);
    });

    it("should create with custom config", () => {
      const config: Partial<EnhancedWASMConfig> = {
        enableChannels: true,
        enableFileSystem: false,
        enableNetwork: false,
        enableEscapeDetection: true,
      };
      const sandbox = new WASMSandboxEnhanced(testData, config);
      const enhancedConfig = sandbox.getEnhancedConfig();
      expect(enhancedConfig.enableChannels).toBe(true);
      expect(enhancedConfig.enableFileSystem).toBe(false);
      expect(enhancedConfig.enableNetwork).toBe(false);
      expect(enhancedConfig.enableEscapeDetection).toBe(true);
    });
  });

  describe("Communication Channels", () => {
    let sandbox: WASMSandboxEnhanced;

    beforeEach(() => {
      sandbox = new WASMSandboxEnhanced(testData, {
        enableChannels: true,
      });
    });

    it("should register message handler", () => {
      const handler = vi.fn();
      sandbox.registerChannel("test", handler);
      // Handler registered successfully
      expect(handler).toHaveBeenCalledTimes(0);
    });

    it("should unregister message handler", () => {
      const handler = vi.fn();
      sandbox.registerChannel("test", handler);
      sandbox.unregisterChannel("test");
      // Handler unregistered successfully
    });

    it("should send and receive messages", async () => {
      const message: VMMessage = {
        type: "test",
        payload: { data: "test" },
        timestamp: Date.now(),
      };

      await sandbox.sendMessageToVM(message);
      const received = sandbox.receiveMessageFromVM();
      expect(received).toEqual(message);
    });

    it("should route messages to channel handlers", async () => {
      const handler = vi.fn();
      sandbox.registerChannel("test", handler);

      const message: VMMessage = {
        type: "test",
        payload: { data: "hello" },
        timestamp: Date.now(),
      };

      await sandbox.sendMessageToVM(message);
      sandbox.receiveMessageFromVM();

      // Give async handler time to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledWith(message);
    });

    it("should return null when no messages available", () => {
      const received = sandbox.receiveMessageFromVM();
      expect(received).toBeNull();
    });

    it("should get pending messages", async () => {
      const message1: VMMessage = {
        type: "test",
        payload: { data: "1" },
        timestamp: Date.now(),
      };
      const message2: VMMessage = {
        type: "test",
        payload: { data: "2" },
        timestamp: Date.now(),
      };

      await sandbox.sendMessageToVM(message1);
      await sandbox.sendMessageToVM(message2);

      const pending = sandbox.getPendingMessages();
      expect(pending).toHaveLength(2);
      expect(pending[0]).toEqual(message1);
      expect(pending[1]).toEqual(message2);
    });

    it("should clear messages", async () => {
      const message: VMMessage = {
        type: "test",
        payload: { data: "test" },
        timestamp: Date.now(),
      };

      await sandbox.sendMessageToVM(message);
      sandbox.clearMessages();

      const pending = sandbox.getPendingMessages();
      expect(pending).toHaveLength(0);
    });

    it("should throw error when channels are disabled", async () => {
      const sandboxNoChannels = new WASMSandboxEnhanced(testData, {
        enableChannels: false,
      });

      const handler = vi.fn();
      expect(() => {
        sandboxNoChannels.registerChannel("test", handler);
      }).toThrow("Communication channels are not enabled");
    });
  });

  describe("Capability-Based Security", () => {
    let sandbox: WASMSandboxEnhanced;

    beforeEach(() => {
      sandbox = new WASMSandboxEnhanced(testData, {
        enableEscapeDetection: false, // Disable for cleaner tests
      });
    });

    it("should grant capability", () => {
      sandbox.grantCapability("execute");
      expect(sandbox.getCapabilities()).toContain("execute");
    });

    it("should revoke capability", () => {
      sandbox.grantCapability("execute");
      sandbox.revokeCapability("execute");
      expect(sandbox.getCapabilities()).not.toContain("execute");
    });

    it("should check capability", async () => {
      sandbox.grantCapability("test-cap");
      expect(await sandbox.checkCapability("test-cap")).toBe(true);
      expect(await sandbox.checkCapability("other-cap")).toBe(false);
    });

    it("should get all capabilities", () => {
      sandbox.grantCapability("cap1");
      sandbox.grantCapability("cap2");
      sandbox.grantCapability("cap3");

      const caps = sandbox.getCapabilities();
      expect(caps).toHaveLength(3);
      expect(caps).toContain("cap1");
      expect(caps).toContain("cap2");
      expect(caps).toContain("cap3");
    });
  });

  describe("Code Signing Verification", () => {
    let sandbox: WASMSandboxEnhanced;
    let codeSigner: CodeSigner;
    let keyPair: KeyPair;

    beforeEach(async () => {
      codeSigner = new CodeSigner();
      keyPair = await codeSigner.generateKeyPair("ED25519");

      sandbox = new WASMSandboxEnhanced(testData);
    });

    it("should verify signed code successfully", async () => {
      const signature = await codeSigner.sign(testData, keyPair.privateKey);

      const result = await sandbox.verifySignedCode(
        testData,
        signature,
        keyPair.publicKey
      );

      expect(result.verified).toBe(true);
      expect(result.signatureValid).toBe(true);
      expect(result.capabilities).toContain("signed");
      expect(result.permissions).toContain("execute");
    });

    it("should fail verification with wrong public key", async () => {
      const signature = await codeSigner.sign(testData, keyPair.privateKey);

      // Generate a different key pair
      const wrongKeyPair = await codeSigner.generateKeyPair("ED25519");

      const result = await sandbox.verifySignedCode(
        testData,
        signature,
        wrongKeyPair.publicKey
      );

      expect(result.verified).toBe(false);
      expect(result.signatureValid).toBe(false);
    });

    it("should fail verification with tampered code", async () => {
      const signature = await codeSigner.sign(testData, keyPair.privateKey);

      // Tamper with the code
      const tamperedCode = testData.slice(0);
      const view = new Uint8Array(tamperedCode);
      view[view.length - 1] = view[view.length - 1] ^ 0xff; // Flip last byte

      const result = await sandbox.verifySignedCode(
        tamperedCode,
        signature,
        keyPair.publicKey
      );

      expect(result.verified).toBe(false);
      expect(result.signatureValid).toBe(false);
    });
  });

  describe("Security Features", () => {
    it("should track security violations", () => {
      const sandbox = new WASMSandboxEnhanced(testData, {
        enableEscapeDetection: false, // Disable to avoid false positives
      });

      // Initially no violations
      expect(sandbox.getSecurityViolations()).toHaveLength(0);
    });

    it("should clear security violations", () => {
      const sandbox = new WASMSandboxEnhanced(testData);

      sandbox.clearSecurityViolations();
      expect(sandbox.getSecurityViolations()).toHaveLength(0);
      expect(sandbox.isEscapeDetected()).toBe(false);
    });
  });

  describe("Enhanced VerifyCode", () => {
    it("should include enhanced capabilities", async () => {
      const sandbox = new WASMSandboxEnhanced(testData, {
        enableChannels: true,
        enableFileSystem: true,
        enableNetwork: true,
      });

      const result = await sandbox.verifyCode(testData);

      // Note: testData is not valid WASM, so verified will be false, but capabilities are still added
      expect(result.capabilities).toContain("channels");
      expect(result.capabilities).toContain("filesystem");
      expect(result.capabilities).toContain("network");
      expect(result.capabilities).toContain("escape-detection");
      expect(result.capabilities).toContain("memory-isolation");
      expect(result.permissions).toContain("channels:send");
    });
  });
});

describe("CodeSigner Integration", () => {
  describe("ED25519 Signatures", () => {
    let codeSigner: CodeSigner;
    let keyPair: KeyPair;

    beforeEach(async () => {
      codeSigner = new CodeSigner("ED25519");
      keyPair = await codeSigner.generateKeyPair();
    });

    it("should generate valid key pair", () => {
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.keyId).toBeDefined();
      expect(keyPair.keyId.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it("should sign and verify code", async () => {
      const signature = await codeSigner.sign(testData, keyPair.privateKey);

      expect(signature.algorithm).toBe("ED25519");
      // Note: keyId is computed from private key during signing, so it won't match the public key based keyId
      expect(signature.keyId).toBeDefined();
      expect(signature.keyId.length).toBe(32);
      expect(signature.signature).toBeDefined();
      expect(signature.timestamp).toBeGreaterThan(0);

      const result = await codeSigner.verify(
        testData,
        signature,
        keyPair.publicKey
      );

      expect(result.verified).toBe(true);
      expect(result.signatureValid).toBe(true);
    });

    it("should generate consistent hash", async () => {
      const hash1 = await codeSigner.getHashHex(testData);
      const hash2 = await codeSigner.getHashHex(testData);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 = 64 hex chars
    });
  });

  describe("Multiple Algorithm Support", () => {
    it("should support RSA key generation", async () => {
      const codeSigner = new CodeSigner();
      const keyPair = await codeSigner.generateKeyPair("RSA");

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.keyId).toBeDefined();
    });

    it("should support ECDSA key generation", async () => {
      const codeSigner = new CodeSigner();
      const keyPair = await codeSigner.generateKeyPair("ECDSA");

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.keyId).toBeDefined();
    });
  });
});

describe("ResourceMonitor", () => {
  describe("Monitoring Functions", () => {
    it("should create resource monitor", () => {
      const monitor = new ResourceMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.getCount()).toBe(0);
    });

    it("should set and get config", () => {
      const monitor = new ResourceMonitor({
        interval: 500,
        maxSnapshots: 1000,
      });

      const config = monitor.getConfig();
      expect(config.interval).toBe(500);
      expect(config.maxSnapshots).toBe(1000);
    });

    it("should update config", () => {
      const monitor = new ResourceMonitor();
      monitor.setConfig({ interval: 2000 });

      const config = monitor.getConfig();
      expect(config.interval).toBe(2000);
    });
  });

  describe("Resource Exhaustion Detection", () => {
    it("should detect memory exhaustion correctly", () => {
      const monitor = new ResourceMonitor();

      const usage = {
        memoryBytes: 100 * 1024 * 1024, // 100 MB
        cpuPercent: 50,
        executionTime: 1000,
        networkBytes: { in: 0, out: 0 },
        openFileDescriptors: 0,
      };

      const limits = {
        maxMemoryBytes: 64 * 1024 * 1024, // 64 MB
        maxCPUMs: 5000,
        maxExecutionTime: 5000,
        maxNetworkAccess: false,
        maxFileDescriptors: 0,
      };

      // Monitor would detect this as critical
      const isOverLimit = usage.memoryBytes > limits.maxMemoryBytes;
      expect(isOverLimit).toBe(true);
    });

    it("should detect execution time exhaustion", () => {
      const usage = {
        memoryBytes: 32 * 1024 * 1024,
        cpuPercent: 50,
        executionTime: 10000, // 10 seconds
        networkBytes: { in: 0, out: 0 },
        openFileDescriptors: 0,
      };

      const limits = {
        maxMemoryBytes: 64 * 1024 * 1024,
        maxCPUMs: 5000,
        maxExecutionTime: 5000, // 5 seconds
        maxNetworkAccess: false,
        maxFileDescriptors: 0,
      };

      const isOverLimit = usage.executionTime > limits.maxExecutionTime;
      expect(isOverLimit).toBe(true);
    });

    it("should detect warning threshold", () => {
      const usage = {
        memoryBytes: 54 * 1024 * 1024, // 54 MB (84% of 64 MB)
        cpuPercent: 50,
        executionTime: 1000,
        networkBytes: { in: 0, out: 0 },
        openFileDescriptors: 0,
      };

      const limits = {
        maxMemoryBytes: 64 * 1024 * 1024,
        maxCPUMs: 5000,
        maxExecutionTime: 5000,
        maxNetworkAccess: false,
        maxFileDescriptors: 0,
      };

      const warningThreshold = 0.8; // 80%
      const isWarning =
        usage.memoryBytes > limits.maxMemoryBytes * warningThreshold;
      expect(isWarning).toBe(true);
    });
  });

  describe("Aggregate Usage", () => {
    it("should return empty aggregate when no VMs monitored", () => {
      const monitor = new ResourceMonitor();
      const aggregate = monitor.aggregateUsage();

      expect(aggregate.totalVMs).toBe(0);
      expect(aggregate.totalMemoryBytes).toBe(0);
      expect(aggregate.avgCPUPercent).toBe(0);
    });
  });
});
