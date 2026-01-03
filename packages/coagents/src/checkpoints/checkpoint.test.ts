/**
 * @fileoverview Checkpoint system tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CheckpointManager,
  createAequorCheckpoints,
} from "./CheckpointManager.js";
import type { CheckpointConfig } from "../state/index.js";
import type { AgentState } from "../state/SharedStateManager.js";

describe("CheckpointManager", () => {
  let manager: CheckpointManager;
  let testCheckpoint: CheckpointConfig;

  beforeEach(() => {
    manager = new CheckpointManager({
      defaultTimeout: 5000,
      autoRejectOnTimeout: false,
      maxActiveCheckpoints: 10,
    });

    testCheckpoint = {
      id: "test-checkpoint",
      type: "confirmation",
      message: "Please confirm this action",
      nodeId: "test-node",
      required: true,
      timeout: 5000,
    };

    manager.registerCheckpoint(testCheckpoint);
  });

  describe("Checkpoint Registration", () => {
    it("should register a checkpoint", () => {
      const config = manager.getCheckpointConfig("test-checkpoint");
      expect(config).toEqual(testCheckpoint);
    });

    it("should unregister a checkpoint", () => {
      manager.unregisterCheckpoint("test-checkpoint");
      const config = manager.getCheckpointConfig("test-checkpoint");
      expect(config).toBeUndefined();
    });

    it("should get all registered checkpoints", () => {
      manager.registerCheckpoint({
        id: "test-2",
        type: "approval",
        message: "Another test",
        nodeId: "test-node",
      });

      // Would need method to get all registered checkpoints
      expect(manager.getCheckpointConfig("test-checkpoint")).toBeDefined();
      expect(manager.getCheckpointConfig("test-2")).toBeDefined();
    });
  });

  describe("Checkpoint Triggering", () => {
    it("should trigger a checkpoint and wait for approval", async () => {
      const testState: AgentState = {
        query: "test query",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test-session",
        complexity: 0.5,
      };

      // Trigger checkpoint
      const promise = manager.triggerCheckpoint("test-checkpoint", testState);

      // Verify checkpoint is active
      expect(manager.isPending("test-checkpoint")).toBe(true);

      // Approve after delay
      setTimeout(() => {
        manager.approveCheckpoint("test-checkpoint", "Looks good");
      }, 100);

      const result = await promise;
      expect(result.status).toBe("approved");
      expect(result.input?.decision).toBe("approve");
    });

    it("should trigger a checkpoint and handle rejection", async () => {
      const testState: AgentState = {
        query: "test query",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test-session",
        complexity: 0.5,
      };

      const promise = manager.triggerCheckpoint("test-checkpoint", testState);

      setTimeout(() => {
        manager.rejectCheckpoint("test-checkpoint", "Not approved");
      }, 100);

      const result = await promise.catch(e => e);
      expect(result).toBeInstanceOf(Error);
    });

    it("should handle timeout", async () => {
      const shortCheckpoint: CheckpointConfig = {
        id: "timeout-test",
        type: "confirmation",
        message: "Quick timeout test",
        nodeId: "test-node",
        timeout: 100,
        required: false,
      };

      manager.registerCheckpoint(shortCheckpoint);

      const testState: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      await expect(
        manager.triggerCheckpoint("timeout-test", testState)
      ).rejects.toThrow("Checkpoint timeout");
    });
  });

  describe("Active Checkpoints", () => {
    it("should get active checkpoint", async () => {
      const testState: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const promise = manager.triggerCheckpoint("test-checkpoint", testState);

      const active = manager.getActiveCheckpoint("test-checkpoint");
      expect(active).toBeDefined();
      expect(active?.status).toBe("pending");

      // Cleanup
      setTimeout(() => manager.cancelCheckpoint("test-checkpoint"), 10);
      await promise.catch(() => {});
    });

    it("should get all active checkpoints", async () => {
      const testState: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const promise1 = manager.triggerCheckpoint("test-checkpoint", testState);
      const active = manager.getActiveCheckpoints();
      expect(active.length).toBeGreaterThan(0);

      // Cleanup
      manager.cancelAllCheckpoints();
      await promise1.catch(() => {});
    });
  });

  describe("Checkpoint Cancellation", () => {
    it("should cancel pending checkpoint", async () => {
      const testState: AgentState = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "test",
        complexity: 0.5,
      };

      const promise = manager.triggerCheckpoint("test-checkpoint", testState);

      setTimeout(() => manager.cancelCheckpoint("test-checkpoint"), 50);

      await expect(promise).rejects.toThrow();
    });

    it("should cancel all pending checkpoints", () => {
      manager.cancelAllCheckpoints();

      const active = manager.getActiveCheckpoints();
      expect(active.length).toBe(0);
    });
  });

  describe("Aequor Default Checkpoints", () => {
    it("should create Aequor checkpoints", () => {
      const checkpoints = createAequorCheckpoints();

      expect(checkpoints.length).toBeGreaterThan(0);
      expect(checkpoints[0]).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        message: expect.any(String),
        nodeId: expect.any(String),
      });
    });

    it("should include required checkpoint types", () => {
      const checkpoints = createAequorCheckpoints();
      const types = new Set(checkpoints.map(cp => cp.type));

      expect(types.has("confirmation")).toBe(true);
      expect(types.has("approval")).toBe(true);
      expect(types.has("correction")).toBe(true);
    });
  });
});
