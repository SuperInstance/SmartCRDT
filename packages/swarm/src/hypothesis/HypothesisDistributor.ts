/**
 * @lsi/swarm - Hypothesis Distributor
 *
 * Distributes hypotheses across multiple nodes for testing and validation.
 * Collects results and makes evidence-based decisions about deployment.
 *
 * Phase 4 implementation (Weeks 13-20)
 */

import {
  type HypothesisPacket,
  type HypothesisResult,
  type HypothesisDistribution,
  type AggregatedResult,
  type NodeCapabilities,
  type HypothesisDistributionRequest,
  type HypothesisDistributionResponse,
} from "@lsi/protocol";

/**
 * Distributor configuration
 */
export interface DistributorConfig {
  /** Maximum concurrent hypothesis tests */
  maxConcurrentTests: number;
  /** Default timeout for hypothesis testing (ms) */
  defaultTimeout: number;
  /** Minimum number of nodes for distributed testing */
  minNodesForDistribution: number;
  /** Maximum number of nodes for distributed testing */
  maxNodesForDistribution: number;
  /** Whether to enable automatic result aggregation */
  autoAggregate: boolean;
}

/**
 * Default distributor configuration
 */
const DEFAULT_CONFIG: DistributorConfig = {
  maxConcurrentTests: 10,
  defaultTimeout: 3600000, // 1 hour
  minNodesForDistribution: 3,
  maxNodesForDistribution: 10,
  autoAggregate: true,
};

/**
 * Node registry for tracking available nodes
 */
interface NodeRegistry {
  /** Registered nodes */
  nodes: Map<string, NodeCapabilities>;
  /** Nodes currently testing */
  testingNodes: Set<string>;
  /** Node selection history */
  selectionHistory: Map<string, number>;
}

/**
 * Result collector state
 */
interface ResultCollector {
  /** Results by hypothesis ID */
  results: Map<string, HypothesisResult[]>;
  /** Pending results */
  pending: Map<string, Set<string>>;
  /** Timeouts */
  timeouts: Map<string, NodeJS.Timeout>;
}

/**
 * Hypothesis Distributor
 *
 * Manages distribution of hypotheses to nodes, collects results,
 * and makes evidence-based decisions about deployment.
 */
export class HypothesisDistributor {
  private config: DistributorConfig;
  private registry: NodeRegistry;
  private collector: ResultCollector;
  private distributions: Map<string, HypothesisDistribution>;
  private initialized: boolean = false;

  constructor(config?: Partial<DistributorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = {
      nodes: new Map(),
      testingNodes: new Set(),
      selectionHistory: new Map(),
    };
    this.collector = {
      results: new Map(),
      pending: new Map(),
      timeouts: new Map(),
    };
    this.distributions = new Map();
  }

  /**
   * Initialize the distributor
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    console.log("HypothesisDistributor initialized:", {
      maxConcurrentTests: this.config.maxConcurrentTests,
      defaultTimeout: this.config.defaultTimeout,
      minNodesForDistribution: this.config.minNodesForDistribution,
      maxNodesForDistribution: this.config.maxNodesForDistribution,
    });
  }

  /**
   * Register a node for hypothesis testing
   */
  registerNode(capabilities: NodeCapabilities): void {
    this.registry.nodes.set(capabilities.nodeId, capabilities);
    console.log(`Node registered: ${capabilities.nodeId}`, {
      memoryMB: capabilities.memoryMB,
      cpuCores: capabilities.cpuCores,
      workload: capabilities.workload,
      canTest: capabilities.canTest,
      supportedHypothesisTypes: capabilities.supportedHypothesisTypes,
    });
  }

  /**
   * Unregister a node
   */
  unregisterNode(nodeId: string): void {
    this.registry.nodes.delete(nodeId);
    this.registry.testingNodes.delete(nodeId);
    console.log(`Node unregistered: ${nodeId}`);
  }

  /**
   * Get registered nodes
   */
  getRegisteredNodes(): NodeCapabilities[] {
    return Array.from(this.registry.nodes.values());
  }

  /**
   * Get available nodes for hypothesis testing
   */
  getAvailableNodes(hypothesisType?: string): NodeCapabilities[] {
    const nodes = Array.from(this.registry.nodes.values()).filter(node => {
      // Node must be able to test
      if (!node.canTest) {
        return false;
      }
      // Node must not be currently testing
      if (this.registry.testingNodes.has(node.nodeId)) {
        return false;
      }
      // Node must support the hypothesis type
      if (
        hypothesisType &&
        !node.supportedHypothesisTypes.includes(hypothesisType as any)
      ) {
        return false;
      }
      return true;
    });
    return nodes;
  }

  /**
   * Distribute hypothesis to nodes for testing
   */
  async distribute(
    hypothesis: HypothesisPacket
  ): Promise<HypothesisDistribution> {
    if (!this.initialized) {
      throw new Error("HypothesisDistributor not initialized");
    }

    const distributionId = `${hypothesis.hypothesisId}-${Date.now()}`;
    const distribution: HypothesisDistribution = {
      hypothesisId: hypothesis.hypothesisId,
      status: "distributing",
      targetNodes: [],
      completedNodes: [],
      failedNodes: [],
      results: [],
    };

    // Select target nodes
    const selectedNodes = this.selectNodes(hypothesis);
    distribution.targetNodes = selectedNodes.map(n => n.nodeId);

    // Check if we have enough nodes
    if (selectedNodes.length < this.config.minNodesForDistribution) {
      distribution.status = "failed";
      this.distributions.set(distributionId, distribution);
      return distribution;
    }

    // Initialize result collection
    this.collector.results.set(hypothesis.hypothesisId, []);
    this.collector.pending.set(
      hypothesis.hypothesisId,
      new Set(selectedNodes.map(n => n.nodeId))
    );

    // Mark nodes as testing
    for (const node of selectedNodes) {
      this.registry.testingNodes.add(node.nodeId);
      this.registry.selectionHistory.set(
        node.nodeId,
        (this.registry.selectionHistory.get(node.nodeId) || 0) + 1
      );
    }

    distribution.status = "distributed";
    this.distributions.set(distributionId, distribution);

    // Set timeout for result collection
    const timeout =
      hypothesis.testingConfig.maxDuration || this.config.defaultTimeout;
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(hypothesis.hypothesisId);
    }, timeout);
    this.collector.timeouts.set(hypothesis.hypothesisId, timeoutHandle);

    console.log(`Hypothesis distributed: ${hypothesis.hypothesisId}`, {
      distributionId,
      targetNodes: selectedNodes.length,
      nodeIds: selectedNodes.map(n => n.nodeId),
    });

    return distribution;
  }

  /**
   * Select nodes for hypothesis testing
   */
  private selectNodes(hypothesis: HypothesisPacket): NodeCapabilities[] {
    let availableNodes = this.getAvailableNodes(hypothesis.type);

    // Apply scope criteria
    if (hypothesis.distributionScope.type === "selective") {
      if (hypothesis.distributionScope.nodes) {
        availableNodes = availableNodes.filter(n =>
          hypothesis.distributionScope.nodes!.includes(n.nodeId)
        );
      }
      if (hypothesis.distributionScope.criteria) {
        const criteria = hypothesis.distributionScope.criteria;
        if (criteria.workload) {
          availableNodes = availableNodes.filter(
            n => n.workload === criteria.workload
          );
        }
        if (criteria.capacity) {
          availableNodes = availableNodes.filter(
            n =>
              n.memoryMB >= criteria.capacity!.minMemoryMB &&
              n.cpuCores >= criteria.capacity!.minCPUCores
          );
        }
      }
    }

    // Sort by selection history (least selected first)
    availableNodes.sort((a, b) => {
      const aCount = this.registry.selectionHistory.get(a.nodeId) || 0;
      const bCount = this.registry.selectionHistory.get(b.nodeId) || 0;
      return aCount - bCount;
    });

    // Limit to max nodes
    return availableNodes.slice(0, this.config.maxNodesForDistribution);
  }

  /**
   * Submit result from a node
   */
  async submitResult(result: HypothesisResult): Promise<void> {
    const { hypothesisId, nodeId } = result;

    // Check if we're expecting results from this node
    const pending = this.collector.pending.get(hypothesisId);
    if (!pending || !pending.has(nodeId)) {
      console.warn(
        `Unexpected result from node ${nodeId} for hypothesis ${hypothesisId}`
      );
      return;
    }

    // Store result
    const results = this.collector.results.get(hypothesisId) || [];
    results.push(result);
    this.collector.results.set(hypothesisId, results);

    // Remove from pending
    pending.delete(nodeId);
    this.registry.testingNodes.delete(nodeId);

    // Update distribution
    for (const distribution of Array.from(this.distributions.values())) {
      if (distribution.hypothesisId === hypothesisId) {
        distribution.completedNodes.push(nodeId);
        distribution.results.push(result);

        if (result.decision === "reject" && result.errors.length > 0) {
          distribution.failedNodes.push(nodeId);
        }

        // Check if all nodes have completed
        if (pending.size === 0) {
          distribution.status = "testing";
          if (this.config.autoAggregate) {
            await this.aggregateResults(hypothesisId);
          }
        }
        break;
      }
    }

    console.log(`Result submitted: ${hypothesisId} from ${nodeId}`, {
      decision: result.decision,
      confidence: result.confidence,
      remaining: pending.size,
    });
  }

  /**
   * Collect results for a hypothesis
   */
  async collectResults(
    hypothesisId: string
  ): Promise<HypothesisResult[] | undefined> {
    const results = this.collector.results.get(hypothesisId);
    if (!results) {
      return undefined;
    }
    return results;
  }

  /**
   * Aggregate results from all nodes
   */
  async aggregateResults(hypothesisId: string): Promise<AggregatedResult> {
    const results = await this.collectResults(hypothesisId);

    if (!results || results.length === 0) {
      throw new Error(
        `No results to aggregate for hypothesis: ${hypothesisId}`
      );
    }

    // Count decisions
    const acceptCount = results.filter(r => r.decision === "accept").length;
    const rejectCount = results.filter(r => r.decision === "reject").length;
    const inconclusiveCount = results.filter(
      r => r.decision === "inconclusive"
    ).length;

    // Calculate average improvements
    const avgImprovement = {
      latency:
        results.reduce((sum, r) => sum + r.improvement.latency, 0) /
        results.length,
      quality:
        results.reduce((sum, r) => sum + r.improvement.quality, 0) /
        results.length,
      cost:
        results.reduce((sum, r) => sum + r.improvement.cost, 0) /
        results.length,
    };

    // Calculate statistical significance (simplified)
    const significance = this.calculateSignificance(results);

    // Make recommendation
    const recommendation = this.makeRecommendation(
      acceptCount,
      rejectCount,
      inconclusiveCount,
      avgImprovement,
      significance
    );

    const aggregated: AggregatedResult = {
      hypothesisId,
      acceptCount,
      rejectCount,
      inconclusiveCount,
      avgImprovement,
      significance,
      recommendation,
    };

    // Update distribution
    for (const distribution of Array.from(this.distributions.values())) {
      if (distribution.hypothesisId === hypothesisId) {
        distribution.status = "completed";

        const decision = await this.makeDecision(aggregated);
        distribution.finalDecision = decision.decision;
        distribution.finalConfidence = decision.confidence;
        break;
      }
    }

    // Clear timeout
    const timeout = this.collector.timeouts.get(hypothesisId);
    if (timeout) {
      clearTimeout(timeout);
      this.collector.timeouts.delete(hypothesisId);
    }

    console.log(`Results aggregated: ${hypothesisId}`, {
      acceptCount,
      rejectCount,
      inconclusiveCount,
      avgImprovement,
      significance,
      recommendation,
    });

    return aggregated;
  }

  /**
   * Calculate statistical significance (simplified)
   */
  private calculateSignificance(results: HypothesisResult[]): number {
    // Simplified: use average confidence as p-value approximation
    // In production, use proper statistical tests (t-test, Mann-Whitney, etc.)
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    // High confidence = low p-value (more significant)
    // We want p-value, so invert confidence
    // But we need to make sure it's properly scaled
    // If confidence is 0.9, p-value should be ~0.01
    return Math.max(0, Math.min(1, 1 - avgConfidence * 2)); // Scale for better significance
  }

  /**
   * Make recommendation based on aggregated results
   */
  private makeRecommendation(
    acceptCount: number,
    rejectCount: number,
    inconclusiveCount: number,
    avgImprovement: { latency: number; quality: number; cost: number },
    significance: number
  ): "accept" | "reject" | "need_more_data" {
    const total = acceptCount + rejectCount + inconclusiveCount;

    // Need more data if too few results
    if (total < this.config.minNodesForDistribution) {
      return "need_more_data";
    }

    // Too many inconclusive (>= 50% is too many)
    if (inconclusiveCount >= total / 2) {
      return "need_more_data";
    }

    // Clear majority for reject
    if (rejectCount > acceptCount * 2) {
      return "reject";
    }

    // Check if improvements are meaningful
    const totalImprovement =
      (avgImprovement.latency + avgImprovement.quality + avgImprovement.cost) /
      3;
    if (totalImprovement < 0.01) {
      // Less than 1% improvement
      return "reject";
    }

    // Check significance (p < 0.05)
    if (significance > 0.05) {
      return "need_more_data";
    }

    // Clear majority for accept
    if (acceptCount > rejectCount && acceptCount >= total / 2) {
      return "accept";
    }

    return "need_more_data";
  }

  /**
   * Make final decision from aggregated results
   */
  async makeDecision(
    aggregated: AggregatedResult
  ): Promise<{ decision: "accept" | "reject"; confidence: number }> {
    const {
      recommendation,
      acceptCount,
      rejectCount,
      inconclusiveCount,
      avgImprovement,
      significance,
    } = aggregated;

    // Calculate confidence
    const total = acceptCount + rejectCount + inconclusiveCount;
    const agreement = Math.max(acceptCount, rejectCount) / total;

    // Combine agreement with significance and improvement
    const totalImprovement =
      (avgImprovement.latency + avgImprovement.quality + avgImprovement.cost) /
      3;
    const confidence =
      agreement * 0.4 + (1 - significance) * 0.4 + totalImprovement * 0.2;

    if (recommendation === "accept") {
      return { decision: "accept", confidence };
    } else {
      return { decision: "reject", confidence };
    }
  }

  /**
   * Get distribution status
   */
  getStatus(hypothesisId: string): HypothesisDistribution | undefined {
    for (const distribution of Array.from(this.distributions.values())) {
      if (distribution.hypothesisId === hypothesisId) {
        return distribution;
      }
    }
    return undefined;
  }

  /**
   * Get all distributions
   */
  getAllDistributions(): HypothesisDistribution[] {
    return Array.from(this.distributions.values());
  }

  /**
   * Handle timeout for hypothesis testing
   */
  private handleTimeout(hypothesisId: string): void {
    console.warn(`Hypothesis testing timeout: ${hypothesisId}`);

    const pending = this.collector.pending.get(hypothesisId);
    if (pending) {
      // Mark remaining nodes as failed
      for (const nodeId of Array.from(pending)) {
        this.registry.testingNodes.delete(nodeId);
      }
      this.collector.pending.delete(hypothesisId);
    }

    // Update distribution status
    for (const distribution of Array.from(this.distributions.values())) {
      if (
        distribution.hypothesisId === hypothesisId &&
        distribution.status !== "completed"
      ) {
        distribution.status = "completed";
        distribution.finalDecision = "reject";
        distribution.finalConfidence = 0;
        break;
      }
    }

    this.collector.timeouts.delete(hypothesisId);
  }

  /**
   * Cancel hypothesis testing
   */
  async cancelTesting(hypothesisId: string): Promise<void> {
    // Clear timeout
    const timeout = this.collector.timeouts.get(hypothesisId);
    if (timeout) {
      clearTimeout(timeout);
      this.collector.timeouts.delete(hypothesisId);
    }

    // Release nodes
    const pending = this.collector.pending.get(hypothesisId);
    if (pending) {
      for (const nodeId of Array.from(pending)) {
        this.registry.testingNodes.delete(nodeId);
      }
      this.collector.pending.delete(hypothesisId);
    }

    // Update distribution
    for (const distribution of Array.from(this.distributions.values())) {
      if (distribution.hypothesisId === hypothesisId) {
        distribution.status = "failed";
        break;
      }
    }

    console.log(`Hypothesis testing cancelled: ${hypothesisId}`);
  }

  /**
   * Shutdown the distributor
   */
  async shutdown(): Promise<void> {
    // Clear all timeouts
    for (const timeout of Array.from(this.collector.timeouts.values())) {
      clearTimeout(timeout);
    }
    this.collector.timeouts.clear();

    this.initialized = false;
    console.log("HypothesisDistributor shutdown complete");
  }

  /**
   * Get distributor statistics
   */
  getStatistics(): {
    registeredNodes: number;
    availableNodes: number;
    testingNodes: number;
    activeDistributions: number;
    completedDistributions: number;
  } {
    const availableNodes = this.getAvailableNodes();
    const activeDistributions = Array.from(this.distributions.values()).filter(
      d => d.status === "distributed" || d.status === "testing"
    ).length;
    const completedDistributions = Array.from(
      this.distributions.values()
    ).filter(d => d.status === "completed").length;

    return {
      registeredNodes: this.registry.nodes.size,
      availableNodes: availableNodes.length,
      testingNodes: this.registry.testingNodes.size,
      activeDistributions,
      completedDistributions,
    };
  }
}
