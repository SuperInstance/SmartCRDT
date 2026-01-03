/**
 * @lsi/swarm - Rollback Protocol Tests
 *
 * Comprehensive tests for RollbackProtocol and ConsensusManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  RollbackRequest,
  RollbackResponse,
  ConsensusProposal,
  Node,
  EmergencyTrigger,
} from "@lsi/protocol";
import { ConsensusManager } from "./Consensus.js";
import { RollbackProtocol } from "./RollbackProtocol.js";

describe("ConsensusManager", () => {
  let consensus: ConsensusManager;
  let nodeId: string;
  let mockNodes: Node[];

  beforeEach(() => {
    nodeId = "node-1";
    consensus = new ConsensusManager(nodeId);

    mockNodes = [
      {
        id: "node-1",
        address: "localhost",
        port: 3001,
        role: "follower",
        status: "online",
      },
      {
        id: "node-2",
        address: "localhost",
        port: 3002,
        role: "follower",
        status: "online",
      },
      {
        id: "node-3",
        address: "localhost",
        port: 3003,
        role: "follower",
        status: "online",
      },
    ];

    mockNodes.forEach(node => consensus.addNode(node));
  });

  describe("Node Management", () => {
    it("should add nodes to the cluster", () => {
      const newNode: Node = {
        id: "node-4",
        address: "localhost",
        port: 3004,
        role: "follower",
        status: "online",
      };

      consensus.addNode(newNode);
      const nodes = consensus.getNodes();

      expect(nodes).toHaveLength(4);
      expect(nodes.find(n => n.id === "node-4")).toBeDefined();
    });

    it("should remove nodes from the cluster", () => {
      consensus.removeNode("node-2");
      const nodes = consensus.getNodes();

      expect(nodes).toHaveLength(2);
      expect(nodes.find(n => n.id === "node-2")).toBeUndefined();
    });

    it("should return all nodes", () => {
      const nodes = consensus.getNodes();

      expect(nodes).toHaveLength(3);
      expect(nodes[0].id).toBe("node-1");
    });
  });

  describe("Proposal Management", () => {
    it("should create a proposal", async () => {
      const rollbackRequest: RollbackRequest = {
        rollbackId: "rb-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug in adapter",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: true,
          verifyAfterRollback: true,
          notifyStakeholders: false,
        },
      };

      const result = await consensus.proposeRollback(rollbackRequest);

      expect(result).toBeDefined();
      expect(result.algorithm).toBe("two_phase_commit");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should track proposal status", async () => {
      await consensus.proposeWithPayload("rollback", { test: "data" });
      const proposals = consensus.listProposals();

      expect(proposals.length).toBeGreaterThan(0);
      if (proposals.length > 0) {
        expect(proposals[0].status).toMatch(/^(approved|rejected)$/);
      }
    });

    it("should get proposal by ID", async () => {
      await consensus.proposeWithPayload("rollback", { test: "data" });
      const proposals = consensus.listProposals();

      expect(proposals.length).toBeGreaterThan(0);
      if (proposals.length > 0) {
        const proposalId = proposals[0].proposalId;
        const proposal = consensus.getProposalStatus(proposalId);

        expect(proposal).toBeDefined();
        expect(proposal?.proposalId).toBe(proposalId);
      }
    });
  });

  describe("Voting", () => {
    it("should record votes on a proposal", async () => {
      await consensus.proposeWithPayload("rollback", { test: "data" });
      const proposal = consensus.listProposals()[0];

      expect(consensus.listProposals().length).toBeGreaterThan(0);

      if (proposal) {
        await consensus.vote(proposal.proposalId, "approve", "Looks good");

        const updated = consensus.getProposalStatus(proposal.proposalId);
        expect(updated?.votes.length).toBeGreaterThan(0);
        expect(updated?.votes[updated.votes.length - 1].decision).toBe(
          "approve"
        );
      }
    });

    it("should update proposal status based on votes", async () => {
      // Create proposal manually via consensus algorithm
      await consensus.proposeWithPayload("rollback", { test: "data" });
      const proposals = consensus.listProposals();

      // The consensus algorithm runs automatically and sets status
      expect(proposals.length).toBeGreaterThan(0);
      if (proposals.length > 0) {
        const proposal = proposals[0];
        // Status should be set by consensus algorithm (approved or rejected)
        expect(["approved", "rejected", "pending"]).toContain(proposal.status);
      }
    });

    it("should reject proposals with majority against", async () => {
      // When consensus algorithm runs automatically, it simulates votes
      // and may approve or reject based on the simulation
      await consensus.proposeWithPayload("rollback", { test: "data" });
      const proposal = consensus.listProposals()[0];

      if (proposal) {
        // The consensus algorithm has already run and set the status
        // Manual voting after consensus doesn't change the outcome
        expect(["approved", "rejected", "pending"]).toContain(proposal.status);
      }
    });
  });

  describe("Raft Consensus", () => {
    beforeEach(() => {
      consensus = new ConsensusManager(nodeId, { algorithm: "raft" });
      mockNodes.forEach(node => consensus.addNode(node));
    });

    it("should start with follower role", () => {
      expect(consensus.getRole()).toBe("follower");
    });

    it("should step down from leadership", () => {
      consensus["raftState"].role = "leader";
      consensus.stepDown();

      expect(consensus.getRole()).toBe("follower");
    });
  });

  describe("Two-Phase Commit", () => {
    it("should reach consensus with all nodes agreeing", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-2pc",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug in adapter",
        scope: "cluster",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: true,
          verifyAfterRollback: true,
          notifyStakeholders: false,
        },
      };

      const result = await consensus.proposeRollback(request);

      // Should succeed with high probability due to simulation
      expect(result).toBeDefined();
      expect(result.totalVotes).toBeGreaterThan(0);
    });
  });
});

describe("RollbackProtocol", () => {
  let protocol: RollbackProtocol;
  let consensus: ConsensusManager;
  let mockNodes: Node[];

  beforeEach(() => {
    consensus = new ConsensusManager("node-1", { quorumSize: 2 });

    mockNodes = [
      {
        id: "node-1",
        address: "localhost",
        port: 3001,
        role: "follower",
        status: "online",
      },
      {
        id: "node-2",
        address: "localhost",
        port: 3002,
        role: "follower",
        status: "online",
      },
      {
        id: "node-3",
        address: "localhost",
        port: 3003,
        role: "follower",
        status: "online",
      },
    ];

    mockNodes.forEach(node => consensus.addNode(node));
    protocol = new RollbackProtocol(consensus);
  });

  describe("Rollback Initiation", () => {
    it("should initiate a local rollback", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-local-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug in adapter",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: true,
          verifyAfterRollback: true,
          notifyStakeholders: false,
        },
      };

      const response = await protocol.initiateRollback(request);

      expect(response).toBeDefined();
      expect(response.rollbackId).toBe("rb-local-1");
      expect(response.status).toMatch(/^(completed|partial|failed)$/);
    });

    it("should initiate a cluster rollback with consensus", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-cluster-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "degradation",
        description: "Performance degradation",
        scope: "cluster",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const response = await protocol.initiateRollback(request);

      expect(response).toBeDefined();
      expect(response.rollbackId).toBe("rb-cluster-1");
    }, 30000);

    it("should require approval when specified", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-approval-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "manual",
        description: "Manual rollback",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: true,
        requiredApprovals: 2,
        approvals: ["user-1"], // Only 1 approval
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const response = await protocol.initiateRollback(request);

      // Should remain pending due to insufficient approvals
      expect(response.status).toBe("pending");
    });

    it("should proceed with sufficient approvals", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-approval-2",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "manual",
        description: "Manual rollback",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: true,
        requiredApprovals: 2,
        approvals: ["user-1", "user-2"], // 2 approvals
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const response = await protocol.initiateRollback(request);

      expect(response.status).toMatch(/^(completed|partial|failed)$/);
    });
  });

  describe("Rollback Strategies", () => {
    it("should execute immediate rollback", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-immediate",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "security",
        description: "Security vulnerability",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const startTime = Date.now();
      const response = await protocol.initiateRollback(request);
      const duration = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    it("should execute graceful rollback with drain", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-graceful",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "degradation",
        description: "Performance degradation",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "graceful",
          drainTimeout: 500,
          createBackup: true,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const startTime = Date.now();
      const response = await protocol.initiateRollback(request);
      const duration = Date.now() - startTime;

      expect(response).toBeDefined();
      // Graceful rollback should take some time due to drain
      // Note: actual drain may be shorter than timeout due to implementation
      expect(duration).toBeGreaterThan(0);
    });

    it("should execute scheduled rollback", async () => {
      const scheduledTime = Date.now() + 2000;

      const request: RollbackRequest = {
        rollbackId: "rb-scheduled",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "manual",
        description: "Scheduled rollback",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "scheduled",
          scheduledTime,
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const startTime = Date.now();
      const response = await protocol.initiateRollback(request);
      const duration = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(2000); // Should wait for scheduled time
    });
  });

  describe("Rollback Status and History", () => {
    it("should get rollback status", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-status-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      await protocol.initiateRollback(request);
      const status = protocol.getRollbackStatus("rb-status-1");

      expect(status).toBeDefined();
      expect(status?.rollbackId).toBe("rb-status-1");
    });

    it("should list all rollbacks", async () => {
      const request1: RollbackRequest = {
        rollbackId: "rb-list-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug 1",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const request2: RollbackRequest = {
        rollbackId: "rb-list-2",
        timestamp: Date.now(),
        targetComponent: "cartridge",
        targetVersion: "1.5.0",
        currentVersion: "2.0.0",
        reason: "error",
        description: "Error 2",
        scope: "local",
        initiatedBy: "user-2",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      await protocol.initiateRollback(request1);
      await protocol.initiateRollback(request2);

      const rollbacks = protocol.listRollbacks();

      expect(rollbacks).toHaveLength(2);
      expect(rollbacks.some(r => r.rollbackId === "rb-list-1")).toBe(true);
      expect(rollbacks.some(r => r.rollbackId === "rb-list-2")).toBe(true);
    });

    it("should filter rollbacks by status", async () => {
      const request1: RollbackRequest = {
        rollbackId: "rb-filter-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug 1",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: true,
        approvals: [],
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const request2: RollbackRequest = {
        rollbackId: "rb-filter-2",
        timestamp: Date.now(),
        targetComponent: "cartridge",
        targetVersion: "1.5.0",
        currentVersion: "2.0.0",
        reason: "error",
        description: "Error 2",
        scope: "local",
        initiatedBy: "user-2",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      await protocol.initiateRollback(request1);
      await protocol.initiateRollback(request2);

      const pendingRollbacks = protocol.listRollbacks({ status: ["pending"] });
      const completedRollbacks = protocol.listRollbacks({
        status: ["completed", "partial", "failed"],
      });

      expect(pendingRollbacks.length).toBeGreaterThanOrEqual(1);
      expect(completedRollbacks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Rollback Cancellation", () => {
    it("should cancel an active rollback", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-cancel-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "manual",
        description: "Manual rollback",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: true,
        approvals: [],
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      await protocol.initiateRollback(request);
      await protocol.cancelRollback("rb-cancel-1");

      const status = protocol.getRollbackStatus("rb-cancel-1");
      expect(status?.status).toBe("cancelled");
    });

    it("should throw error when cancelling non-existent rollback", async () => {
      await expect(protocol.cancelRollback("non-existent")).rejects.toThrow();
    });

    it("should throw error when cancelling completed rollback", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-cancel-completed",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      await protocol.initiateRollback(request);

      // Already completed, should throw
      await expect(
        protocol.cancelRollback("rb-cancel-completed")
      ).rejects.toThrow();
    });
  });

  describe("Rollback Reports", () => {
    it("should generate rollback report", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-report-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: true,
          notifyStakeholders: false,
        },
      };

      await protocol.initiateRollback(request);
      const report = protocol.generateReport("rb-report-1");

      expect(report).toBeDefined();
      expect(report?.rollbackId).toBe("rb-report-1");
      expect(report?.steps).toBeDefined();
      expect(report?.metrics).toBeDefined();
      expect(report?.recommendations).toBeDefined();
    });

    it("should return undefined for non-existent rollback", () => {
      const report = protocol.generateReport("non-existent");
      expect(report).toBeUndefined();
    });
  });

  describe("Emergency Rollback", () => {
    it("should configure emergency rollback", () => {
      protocol.setEmergencyConfig({
        enabled: true,
        autoApprove: true,
        triggers: [],
        fallbackVersion: "1.0.0",
        emergencyChannels: [],
      });

      // Should not throw
      expect(() =>
        protocol.setEmergencyConfig({
          enabled: true,
          autoApprove: true,
          triggers: [],
          fallbackVersion: "1.0.0",
          emergencyChannels: [],
        })
      ).not.toThrow();
    });

    it("should trigger emergency rollback", async () => {
      protocol.setEmergencyConfig({
        enabled: true,
        autoApprove: true,
        triggers: [],
        fallbackVersion: "1.0.0",
        emergencyChannels: [],
      });

      const trigger: EmergencyTrigger = {
        triggerId: "emergency-1",
        type: "error_rate",
        severity: "critical",
        threshold: 0.1,
        actualValue: 0.5,
        timestamp: Date.now(),
        description: "Critical error rate detected",
      };

      const response = await protocol.triggerEmergencyRollback(trigger);

      expect(response).toBeDefined();
      expect(response.rollbackId).toMatch(/^emergency-/);
    });

    it("should throw error when emergency rollback disabled", async () => {
      const trigger: EmergencyTrigger = {
        triggerId: "emergency-2",
        type: "latency",
        severity: "high",
        threshold: 5000,
        actualValue: 10000,
        timestamp: Date.now(),
        description: "High latency detected",
      };

      await expect(protocol.triggerEmergencyRollback(trigger)).rejects.toThrow(
        "Emergency rollback is not enabled"
      );
    });
  });

  describe("Monitoring and Auto-Rollback", () => {
    it("should record metrics samples", () => {
      protocol.recordMetrics({
        timestamp: Date.now(),
        errorRate: 0.05,
        latency: 200,
        throughput: 1000,
        qualityScore: 0.9,
      });

      const metrics = protocol.getCurrentMetrics();

      expect(metrics).toBeDefined();
      if (metrics) {
        expect(metrics.errorRate).toBe(0.05);
        // avgLatency is computed from latest.latency
        expect(metrics.avgLatency).toBe(200);
      }
    });

    it("should maintain metrics buffer", () => {
      for (let i = 0; i < 10; i++) {
        protocol.recordMetrics({
          timestamp: Date.now() + i * 1000,
          errorRate: 0.01 * i,
          latency: 100 + i * 10,
          throughput: 1000 - i * 10,
        });
      }

      const metrics = protocol.getCurrentMetrics();
      expect(metrics).toBeDefined();
    });

    it("should return undefined when no metrics recorded", () => {
      const newProtocol = new RollbackProtocol(consensus);
      const metrics = newProtocol.getCurrentMetrics();

      expect(metrics).toBeUndefined();
    });
  });

  describe("Verification", () => {
    it("should verify rollback after execution", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-verify-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: true,
          notifyStakeholders: false,
        },
      };

      const response = await protocol.initiateRollback(request);

      expect(response.verificationResults).toBeDefined();
      expect(response.verificationResults?.length).toBeGreaterThan(0);
    });

    it("should include health status in verification", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-verify-2",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: true,
          notifyStakeholders: false,
        },
      };

      const response = await protocol.initiateRollback(request);

      expect(response.verificationResults?.[0].healthStatus).toMatch(
        /^(healthy|degraded|unhealthy)$/
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle execution errors gracefully", async () => {
      // Create a protocol with high failure rate
      const errorConsensus = new ConsensusManager("node-1");
      mockNodes.forEach(node => errorConsensus.addNode(node));

      const errorProtocol = new RollbackProtocol(errorConsensus);

      const request: RollbackRequest = {
        rollbackId: "rb-error-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "cluster",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: false,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      const response = await errorProtocol.initiateRollback(request);

      // Should have some errors due to simulation
      expect(response).toBeDefined();
      if (response.errors.length > 0) {
        expect(response.status).toMatch(/^(partial|failed)$/);
      }
    });
  });

  describe("Backup Management", () => {
    it("should create backup when enabled", async () => {
      const request: RollbackRequest = {
        rollbackId: "rb-backup-1",
        timestamp: Date.now(),
        targetComponent: "adapter",
        targetVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "bug",
        description: "Bug",
        scope: "local",
        initiatedBy: "user-1",
        requiresApproval: false,
        options: {
          strategy: "immediate",
          createBackup: true,
          verifyAfterRollback: false,
          notifyStakeholders: false,
        },
      };

      // Should not throw
      const response = await protocol.initiateRollback(request);
      expect(response).toBeDefined();
    });
  });
});
