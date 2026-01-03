/**
 * @lsi/swarm - Consensus Manager for Distributed Rollback Operations
 *
 * Implements consensus mechanisms (Raft, Paxos, 2PC) for distributed
 * rollback operations across Aequor nodes.
 *
 * @module Consensus
 */

import type {
  ConsensusAlgorithm,
  ConsensusConfig,
  ConsensusProposal,
  ConsensusResult,
  RollbackRequest,
  Vote,
  VoteDecision,
  ProposalType,
  Node,
} from "@lsi/protocol";

/**
 * Default consensus configuration
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  algorithm: "two_phase_commit",
  quorumSize: 2,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  electionTimeout: 5000,
  heartbeatInterval: 1000,
};

/**
 * State for Raft consensus
 */
interface RaftState {
  currentTerm: number;
  votedFor?: string;
  role: "leader" | "follower" | "candidate";
  leaderId?: string;
  votesReceived: Set<string>;
  log: ConsensusProposal[];
}

/**
 * State for Paxos consensus
 */
interface PaxosState {
  promisedId: number;
  acceptedId: number;
  acceptedValue?: ConsensusProposal;
  proposalNumber: number;
}

/**
 * State for Two-Phase Commit
 */
interface TwoPCState {
  phase: "init" | "prepare" | "commit" | "abort";
  participants: Set<string>;
  prepared: Set<string>;
  committed: Set<string>;
  aborted: Set<string>;
}

/**
 * Consensus Manager - Handles distributed consensus for rollback operations
 */
export class ConsensusManager {
  private config: ConsensusConfig;
  private nodeId: string;
  private proposals: Map<string, ConsensusProposal>;
  private nodes: Map<string, Node>;
  private raftState: RaftState;
  private paxosState: PaxosState;
  private twoPCState: TwoPCState;
  private proposalCounter: number;

  constructor(nodeId: string, config: Partial<ConsensusConfig> = {}) {
    this.nodeId = nodeId;
    this.config = { ...DEFAULT_CONSENSUS_CONFIG, ...config };
    this.proposals = new Map();
    this.nodes = new Map();
    this.proposalCounter = 0;

    // Initialize algorithm-specific state
    this.raftState = {
      currentTerm: 0,
      role: "follower",
      votesReceived: new Set(),
      log: [],
    };

    this.paxosState = {
      promisedId: 0,
      acceptedId: 0,
      proposalNumber: 0,
    };

    this.twoPCState = {
      phase: "init",
      participants: new Set(),
      prepared: new Set(),
      committed: new Set(),
      aborted: new Set(),
    };
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Propose a rollback operation
   */
  async proposeRollback(request: RollbackRequest): Promise<ConsensusResult> {
    const proposal = this.createProposal("rollback", request, undefined);
    return this.executeConsensus(proposal);
  }

  /**
   * Propose a generic operation
   */
  async propose(proposal: ConsensusProposal): Promise<ConsensusResult> {
    return this.executeConsensus(proposal);
  }

  /**
   * Propose a generic operation with payload
   */
  async proposeWithPayload(
    type: ProposalType,
    payload: unknown,
    metadata?: Record<string, unknown>
  ): Promise<ConsensusResult> {
    const proposal = this.createProposal(type, payload, metadata);
    return this.executeConsensus(proposal);
  }

  /**
   * Vote on a proposal
   */
  async vote(
    proposalId: string,
    decision: VoteDecision,
    reason?: string
  ): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    const vote: Vote = {
      nodeId: this.nodeId,
      decision,
      timestamp: Date.now(),
      reason,
    };

    // Check if already voted
    const existingVote = proposal.votes.find(v => v.nodeId === this.nodeId);
    if (existingVote) {
      existingVote.decision = decision;
      existingVote.timestamp = vote.timestamp;
      existingVote.reason = vote.reason;
    } else {
      proposal.votes.push(vote);
    }

    // Update proposal status based on votes
    this.updateProposalStatus(proposal);

    // Check if consensus reached
    if (proposal.status === "approved") {
      await this.executeApprovedProposal(proposal);
    }
  }

  /**
   * Get proposal status
   */
  getProposalStatus(proposalId: string): ConsensusProposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * List all proposals
   */
  listProposals(): ConsensusProposal[] {
    return Array.from(this.proposals.values());
  }

  /**
   * Add a node to the cluster
   */
  addNode(node: Node): void {
    this.nodes.set(node.id, node);
    this.twoPCState.participants.add(node.id);
  }

  /**
   * Remove a node from the cluster
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.twoPCState.participants.delete(nodeId);
  }

  /**
   * Get cluster nodes
   */
  getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get current node role (Raft)
   */
  getRole(): "leader" | "follower" | "candidate" {
    return this.raftState.role;
  }

  /**
   * Step down from leadership (Raft)
   */
  stepDown(): void {
    if (this.raftState.role === "leader") {
      this.raftState.role = "follower";
      this.raftState.leaderId = undefined;
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - Consensus Execution
  // ==========================================================================

  /**
   * Execute consensus based on configured algorithm
   */
  private async executeConsensus(
    proposal: ConsensusProposal
  ): Promise<ConsensusResult> {
    const startTime = Date.now();

    try {
      let result: ConsensusResult;

      switch (this.config.algorithm) {
        case "raft":
          result = await this.raftConsensus(proposal);
          break;
        case "paxos":
          result = await this.paxosConsensus(proposal);
          break;
        case "two_phase_commit":
          result = await this.twoPhaseCommit(proposal);
          break;
        default:
          throw new Error(
            `Unknown consensus algorithm: ${this.config.algorithm}`
          );
      }

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        approved: false,
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        totalVotes: 0,
        quorumReached: false,
        algorithm: this.config.algorithm,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Raft consensus implementation
   */
  private async raftConsensus(
    proposal: ConsensusProposal
  ): Promise<ConsensusResult> {
    // Only leader can propose in Raft
    if (this.raftState.role !== "leader") {
      // Redirect to leader
      if (this.raftState.leaderId) {
        throw new Error(`Not leader. Redirect to ${this.raftState.leaderId}`);
      }
      // Start election
      await this.startElection();
    }

    // Add to log
    this.raftState.log.push(proposal);

    // Collect votes from followers
    const votes = await this.collectVotes(proposal);

    // Check if we have quorum
    const quorumReached = votes.votesFor >= this.config.quorumSize;

    const result: ConsensusResult = {
      approved: quorumReached,
      votesFor: votes.votesFor,
      votesAgainst: votes.votesAgainst,
      votesAbstain: votes.votesAbstain,
      totalVotes: votes.totalVotes,
      quorumReached,
      algorithm: "raft",
      duration: 0, // Set by caller
    };

    // Update proposal status
    proposal.status = quorumReached ? "approved" : "rejected";
    proposal.votes = votes.allVotes;

    return result;
  }

  /**
   * Paxos consensus implementation
   */
  private async paxosConsensus(
    proposal: ConsensusProposal
  ): Promise<ConsensusResult> {
    const proposalNumber = ++this.paxosState.proposalNumber;

    // Phase 1: Prepare
    const promises = await this.sendPreparePromise(proposalNumber);

    // Phase 2: Accept
    if (promises >= this.config.quorumSize) {
      const accepts = await this.sendAcceptPromise(proposal, proposalNumber);

      const quorumReached = accepts >= this.config.quorumSize;

      const result: ConsensusResult = {
        approved: quorumReached,
        votesFor: accepts,
        votesAgainst: this.nodes.size - accepts,
        votesAbstain: 0,
        totalVotes: this.nodes.size,
        quorumReached,
        algorithm: "paxos",
        duration: 0,
      };

      proposal.status = quorumReached ? "approved" : "rejected";
      return result;
    }

    // Quorum not reached
    return {
      approved: false,
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      totalVotes: 0,
      quorumReached: false,
      algorithm: "paxos",
      duration: 0,
    };
  }

  /**
   * Two-Phase Commit implementation
   */
  private async twoPhaseCommit(
    proposal: ConsensusProposal
  ): Promise<ConsensusResult> {
    // Reset state
    this.twoPCState.phase = "prepare";
    this.twoPCState.prepared.clear();
    this.twoPCState.committed.clear();
    this.twoPCState.aborted.clear();

    // Phase 1: Prepare
    const prepareResults = await this.sendPreparePhase(proposal);

    // Check if all participants voted to prepare
    const allPrepared = prepareResults.every(r => r.decision === "approve");

    if (!allPrepared) {
      // Abort
      this.twoPCState.phase = "abort";
      await this.sendAbort();

      return {
        approved: false,
        votesFor: prepareResults.filter(r => r.decision === "approve").length,
        votesAgainst: prepareResults.filter(r => r.decision === "reject")
          .length,
        votesAbstain: prepareResults.filter(r => r.decision === "abstain")
          .length,
        totalVotes: prepareResults.length,
        quorumReached: false,
        algorithm: "two_phase_commit",
        duration: 0,
      };
    }

    // Phase 2: Commit
    this.twoPCState.phase = "commit";
    const commitResults = await this.sendCommit(proposal);

    const allCommitted = commitResults.every(r => r.success);

    const result: ConsensusResult = {
      approved: allCommitted,
      votesFor: prepareResults.filter(r => r.decision === "approve").length,
      votesAgainst: prepareResults.filter(r => r.decision === "reject").length,
      votesAbstain: prepareResults.filter(r => r.decision === "abstain").length,
      totalVotes: prepareResults.length,
      quorumReached: true,
      algorithm: "two_phase_commit",
      duration: 0,
    };

    proposal.status = allCommitted ? "approved" : "rejected";
    return result;
  }

  // ==========================================================================
  // PRIVATE METHODS - Proposal Management
  // ==========================================================================

  /**
   * Create a new proposal
   */
  private createProposal(
    type: ProposalType,
    payload: unknown,
    metadata?: Record<string, unknown>
  ): ConsensusProposal {
    const proposalId = `prop-${this.proposalCounter++}-${Date.now()}`;

    const proposal: ConsensusProposal = {
      proposalId,
      type,
      payload,
      proposedBy: this.nodeId,
      proposedAt: Date.now(),
      votes: [],
      requiredVotes: this.config.quorumSize,
      status: "pending",
      expiresAt: Date.now() + this.config.timeout,
      metadata,
    };

    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  /**
   * Update proposal status based on votes
   */
  private updateProposalStatus(proposal: ConsensusProposal): void {
    const votesFor = proposal.votes.filter(
      v => v.decision === "approve"
    ).length;
    const votesAgainst = proposal.votes.filter(
      v => v.decision === "reject"
    ).length;
    const totalVotes = proposal.votes.length;

    // Check if expired
    if (Date.now() > proposal.expiresAt) {
      proposal.status = "expired";
      return;
    }

    // Check if rejected (majority against)
    if (votesAgainst > proposal.requiredVotes / 2) {
      proposal.status = "rejected";
      return;
    }

    // Check if approved (quorum reached)
    if (votesFor >= proposal.requiredVotes) {
      proposal.status = "approved";
      return;
    }
  }

  /**
   * Execute an approved proposal
   */
  private async executeApprovedProposal(
    proposal: ConsensusProposal
  ): Promise<void> {
    // Override in subclass or provide callback
    // This is a hook for executing the proposal after consensus
    console.log(`Executing approved proposal: ${proposal.proposalId}`);
  }

  // ==========================================================================
  // PRIVATE METHODS - Raft
  // ==========================================================================

  /**
   * Start Raft election
   */
  private async startElection(): Promise<void> {
    this.raftState.currentTerm++;
    this.raftState.role = "candidate";
    this.raftState.votesReceived = new Set([this.nodeId]);

    // Request votes from other nodes
    const votePromises = Array.from(this.nodes.values())
      .filter(n => n.id !== this.nodeId)
      .map(node => this.requestVote(node));

    const votesGranted = await Promise.all(votePromises);

    votesGranted.forEach((granted, idx) => {
      if (granted) {
        const node = Array.from(this.nodes.values()).filter(
          n => n.id !== this.nodeId
        )[idx];
        if (node) {
          this.raftState.votesReceived.add(node.id);
        }
      }
    });

    // Check if won election
    if (this.raftState.votesReceived.size >= this.config.quorumSize) {
      this.raftState.role = "leader";
      this.raftState.leaderId = this.nodeId;
    } else {
      this.raftState.role = "follower";
    }
  }

  /**
   * Request vote from a node (Raft)
   */
  private async requestVote(node: Node): Promise<boolean> {
    // Simulate vote request - in real implementation, would send RPC
    // For now, randomly grant votes
    return Math.random() > 0.3;
  }

  /**
   * Collect votes from followers (Raft)
   */
  private async collectVotes(proposal: ConsensusProposal): Promise<{
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    totalVotes: number;
    allVotes: Vote[];
  }> {
    const votes: Vote[] = [];

    // Simulate collecting votes from all nodes
    for (const node of this.nodes.values()) {
      const decision = this.simulateVote(node, proposal);
      votes.push({
        nodeId: node.id,
        decision,
        timestamp: Date.now(),
      });
    }

    const votesFor = votes.filter(v => v.decision === "approve").length;
    const votesAgainst = votes.filter(v => v.decision === "reject").length;
    const votesAbstain = votes.filter(v => v.decision === "abstain").length;

    return {
      votesFor,
      votesAgainst,
      votesAbstain,
      totalVotes: votes.length,
      allVotes: votes,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Paxos
  // ==========================================================================

  /**
   * Send prepare promise (Paxos Phase 1)
   */
  private async sendPreparePromise(proposalNumber: number): Promise<number> {
    let promises = 0;

    for (const node of this.nodes.values()) {
      if (node.id === this.nodeId) {
        promises++;
        continue;
      }

      // Simulate prepare request
      const promised = Math.random() > 0.2;
      if (promised) {
        promises++;
      }
    }

    return promises;
  }

  /**
   * Send accept request (Paxos Phase 2)
   */
  private async sendAcceptPromise(
    proposal: ConsensusProposal,
    proposalNumber: number
  ): Promise<number> {
    let accepts = 0;

    for (const node of this.nodes.values()) {
      if (node.id === this.nodeId) {
        accepts++;
        continue;
      }

      // Simulate accept request
      const accepted = Math.random() > 0.1;
      if (accepted) {
        accepts++;
      }
    }

    return accepts;
  }

  // ==========================================================================
  // PRIVATE METHODS - Two-Phase Commit
  // ==========================================================================

  /**
   * Send prepare phase (2PC Phase 1)
   */
  private async sendPreparePhase(
    proposal: ConsensusProposal
  ): Promise<Array<{ nodeId: string; decision: VoteDecision }>> {
    const results: Array<{ nodeId: string; decision: VoteDecision }> = [];

    for (const node of this.nodes.values()) {
      if (node.id === this.nodeId) {
        results.push({ nodeId: this.nodeId, decision: "approve" });
        continue;
      }

      // Simulate prepare request
      const decision = this.simulateVote(node, proposal);
      results.push({ nodeId: node.id, decision });
    }

    return results;
  }

  /**
   * Send commit (2PC Phase 2)
   */
  private async sendCommit(
    proposal: ConsensusProposal
  ): Promise<Array<{ nodeId: string; success: boolean; timestamp: number }>> {
    const results: Array<{
      nodeId: string;
      success: boolean;
      timestamp: number;
    }> = [];

    for (const node of this.nodes.values()) {
      // Simulate commit
      const success = Math.random() > 0.1;

      results.push({
        nodeId: node.id,
        success,
        timestamp: Date.now(),
      });
    }

    return results;
  }

  /**
   * Send abort (2PC abort)
   */
  private async sendAbort(): Promise<void> {
    // Notify all participants to abort
    for (const node of this.nodes.values()) {
      // In real implementation, would send abort message
      console.log(`Aborting transaction on node ${node.id}`);
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Simulate a vote decision (for testing)
   */
  private simulateVote(node: Node, proposal: ConsensusProposal): VoteDecision {
    // Simple simulation - 90% approve, 5% reject, 5% abstain
    const rand = Math.random();
    if (rand < 0.9) return "approve";
    if (rand < 0.95) return "reject";
    return "abstain";
  }
}
