/**
 * @fileoverview HITL Checkpoint Tests
 * @coverage 20+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  HITLCheckpointManager,
  createHITLCheckpointManager,
} from "../checkpoints/HITLCheckpoint.js";
import type { VLJEPAAction } from "@lsi/vljepa/src/protocol.js";

describe("HITLCheckpointManager", () => {
  let manager: HITLCheckpointManager;
  let mockActions: VLJEPAAction[];

  beforeEach(() => {
    manager = createHITLCheckpointManager({
      defaultTimeout: 60000,
      maxPending: 50,
      enableVisualDiff: true,
    });

    mockActions = [
      {
        type: "modify",
        target: "#button1",
        params: { color: "red" },
        confidence: 0.9,
      },
      {
        type: "delete",
        target: "#old-element",
        params: {},
        confidence: 0.8,
      },
    ];
  });

  describe("Constructor", () => {
    it("should create with default config", () => {
      const defaultManager = createHITLCheckpointManager();
      expect(defaultManager).toBeDefined();
      const config = defaultManager.getConfig();
      expect(config.defaultTimeout).toBe(60000);
    });

    it("should create with custom config", () => {
      const customManager = createHITLCheckpointManager({
        defaultTimeout: 120000,
        maxPending: 100,
      });

      const config = customManager.getConfig();
      expect(config.defaultTimeout).toBe(120000);
      expect(config.maxPending).toBe(100);
    });
  });

  describe("Checkpoint Creation", () => {
    it("should create checkpoint", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review actions",
        {
          required: false,
          sessionId: "session123",
        }
      );

      expect(id).toBeDefined();

      const checkpoint = manager.getCheckpoint(id);
      expect(checkpoint.id).toBe(id);
      expect(checkpoint.status).toBe("pending");
      expect(checkpoint.actions).toEqual(mockActions);
    });

    it("should create visual confirmation checkpoint", async () => {
      const visualDiff = {
        before: {
          src: "before.png",
          elements: [],
          dimensions: { width: 1920, height: 1080 },
        },
        after: {
          elements: [],
          dimensions: { width: 1920, height: 1080 },
        },
        highlights: [],
      };

      const id = await manager.createVisualCheckpoint(
        mockActions,
        visualDiff,
        "session123"
      );

      const checkpoint = manager.getCheckpoint(id);
      expect(checkpoint.type).toBe("visual_confirmation");
      expect(checkpoint.required).toBe(false);
    });

    it("should create destructive action checkpoint", async () => {
      const destructiveActions: VLJEPAAction[] = [
        { type: "delete", target: "#elem1", params: {}, confidence: 0.9 },
      ];

      const id = await manager.createDestructiveCheckpoint(
        destructiveActions,
        "session123"
      );

      const checkpoint = manager.getCheckpoint(id);
      expect(checkpoint.type).toBe("destructive_action");
      expect(checkpoint.required).toBe(true);
    });

    it("should create low confidence checkpoint", async () => {
      const lowConfidenceActions: VLJEPAAction[] = [
        { type: "modify", target: "#elem1", params: {}, confidence: 0.5 },
        { type: "modify", target: "#elem2", params: {}, confidence: 0.6 },
      ];

      const id = await manager.createLowConfidenceCheckpoint(
        lowConfidenceActions,
        "session123",
        0.7
      );

      const checkpoint = manager.getCheckpoint(id);
      expect(checkpoint.type).toBe("low_confidence");
      expect(checkpoint.actions.length).toBe(2);
    });
  });

  describe("Checkpoint Approval", () => {
    it("should approve checkpoint", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      const approved = await manager.approveCheckpoint(id, "Looks good");

      expect(approved.status).toBe("approved");
      expect(approved.decision).toBe("approve");
      expect(approved.feedback).toBe("Looks good");
      expect(approved.decidedAt).toBeDefined();
    });

    it("should reject checkpoint", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      const rejected = await manager.rejectCheckpoint(id, "Not correct");

      expect(rejected.status).toBe("rejected");
      expect(rejected.decision).toBe("reject");
      expect(rejected.feedback).toBe("Not correct");
    });

    it("should modify checkpoint", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      const modifiedActions: VLJEPAAction[] = [
        {
          type: "modify",
          target: "#button1",
          params: { color: "blue" },
          confidence: 0.9,
        },
      ];

      const modified = await manager.modifyCheckpoint(
        id,
        modifiedActions,
        "Changed color to blue"
      );

      expect(modified.status).toBe("modified");
      expect(modified.decision).toBe("modify");
      expect(modified.modifiedActions).toEqual(modifiedActions);
    });

    it("should throw on approving non-pending checkpoint", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      await manager.approveCheckpoint(id);

      await expect(manager.approveCheckpoint(id)).rejects.toThrow();
    });

    it("should throw on modifying when disabled", async () => {
      const noModManager = createHITLCheckpointManager({
        enableModification: false,
      });

      const id = await noModManager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      await expect(
        noModManager.modifyCheckpoint(id, mockActions)
      ).rejects.toThrow();
    });

    it("should batch approve checkpoints", async () => {
      const ids = await Promise.all([
        manager.createCheckpoint(
          "visual_confirmation",
          mockActions,
          "Review 1",
          {
            required: false,
            sessionId: "session1",
          }
        ),
        manager.createCheckpoint(
          "visual_confirmation",
          mockActions,
          "Review 2",
          {
            required: false,
            sessionId: "session2",
          }
        ),
      ]);

      const approved = await manager.batchApprove(ids, "Batch approve");

      expect(approved.length).toBe(2);
      expect(approved.every(c => c.status === "approved")).toBe(true);
    });
  });

  describe("Checkpoint Query", () => {
    it("should get checkpoint by ID", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      const checkpoint = manager.getCheckpoint(id);

      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toBe(id);
    });

    it("should throw for non-existent checkpoint", () => {
      expect(() => manager.getCheckpoint("nonexistent")).toThrow();
    });

    it("should get session checkpoints", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review 1",
        {
          required: false,
          sessionId: "session123",
        }
      );
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review 2",
        {
          required: false,
          sessionId: "session123",
        }
      );
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review 3",
        {
          required: false,
          sessionId: "session456",
        }
      );

      const session123Ids = manager.getSessionCheckpoints("session123");

      expect(session123Ids.length).toBe(2);
    });

    it("should filter checkpoints by status", async () => {
      const id1 = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      const id2 = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      await manager.approveCheckpoint(id1);

      const pending = manager.filterCheckpoints({ status: ["pending"] });

      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(id2);
    });

    it("should filter checkpoints by type", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );
      await manager.createDestructiveCheckpoint(mockActions, "session123");

      const visual = manager.filterCheckpoints({
        type: ["visual_confirmation"],
      });

      expect(visual.length).toBe(1);
      expect(visual[0].type).toBe("visual_confirmation");
    });

    it("should filter by required flag", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );
      await manager.createDestructiveCheckpoint(mockActions, "session123");

      const required = manager.filterCheckpoints({ required: true });

      expect(required.length).toBe(1);
    });

    it("should apply limit and offset", async () => {
      for (let i = 0; i < 10; i++) {
        await manager.createCheckpoint(
          "visual_confirmation",
          mockActions,
          `Review ${i}`,
          {
            required: false,
            sessionId: `session${i}`,
          }
        );
      }

      const page = manager.filterCheckpoints({ limit: 5, offset: 2 });

      expect(page.length).toBe(5);
    });

    it("should get pending checkpoints", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      await manager.approveCheckpoint(id);

      const pending = manager.getPendingCheckpoints();

      expect(pending.length).toBe(1);
    });

    it("should get required checkpoints", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );
      await manager.createDestructiveCheckpoint(mockActions, "session123");

      const required = manager.getRequiredCheckpoints("session123");

      expect(required.length).toBe(1);
      expect(required[0].required).toBe(true);
    });

    it("should check if session is blocked", async () => {
      await manager.createDestructiveCheckpoint(mockActions, "session123");

      expect(manager.isSessionBlocked("session123")).toBe(true);
      expect(manager.isSessionBlocked("session456")).toBe(false);
    });
  });

  describe("Checkpoint Management", () => {
    it("should delete checkpoint", async () => {
      const id = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      manager.deleteCheckpoint(id);

      expect(() => manager.getCheckpoint(id)).toThrow();
    });

    it("should delete session checkpoints", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review 1",
        {
          required: false,
          sessionId: "session123",
        }
      );
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review 2",
        {
          required: false,
          sessionId: "session123",
        }
      );

      manager.deleteSessionCheckpoints("session123");

      expect(manager.getSessionCheckpoints("session123").length).toBe(0);
    });

    it("should clear all checkpoints", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      manager.clearAllCheckpoints();

      const stats = manager.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should get stats", async () => {
      const id1 = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      const id2 = await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      await manager.approveCheckpoint(id1);
      await manager.rejectCheckpoint(id2, "No");

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(0);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });

    it("should get stats for session", async () => {
      await manager.createCheckpoint(
        "visual_confirmation",
        mockActions,
        "Review",
        {
          required: false,
          sessionId: "session123",
        }
      );

      const stats = manager.getStats("session123");

      expect(stats.total).toBe(1);
    });
  });

  describe("Configuration", () => {
    it("should get config", () => {
      const config = manager.getConfig();

      expect(config.defaultTimeout).toBeDefined();
      expect(config.maxPending).toBeDefined();
      expect(config.enableVisualDiff).toBeDefined();
    });

    it("should update config", () => {
      manager.updateConfig({ defaultTimeout: 120000 });

      const config = manager.getConfig();
      expect(config.defaultTimeout).toBe(120000);
    });
  });
});
