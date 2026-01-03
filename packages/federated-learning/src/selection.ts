/**
 * @fileoverview Client selection strategies for federated learning
 *
 * Implements multiple selection algorithms:
 * - Random sampling (uniform, stratified)
 * - Importance sampling (quality-based, adaptive)
 * - Fairness-aware sampling (diverse, bias-preventing)
 *
 * References:
 * - Caldas et al. (2018) "Expanding the Reach of Federated Learning..."
 * - Li et al. (2020) "Federated Optimization in Heterogeneous Networks"
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Client identifier
 */
export type ClientId = string;

/**
 * Client data distribution metrics
 */
export interface DataDistribution {
  /** Number of training samples */
  sampleCount: number;
  /** Class label distribution (label -> count) */
  classDistribution: Map<string, number>;
  /** Feature distribution statistics */
  featureStats?: Record<string, { mean: number; variance: number }>;
  /** Data quality score [0, 1] */
  qualityScore: number;
  /** Domain/region identifier for stratification */
  domain?: string;
  /** Demographic group identifier for fairness */
  group?: string;
}

/**
 * Client participation history
 */
export interface ParticipationHistory {
  /** Total rounds selected */
  totalSelections: number;
  /** Consecutive rounds selected */
  consecutiveSelections: number;
  /** Last selection round number */
  lastSelectionRound?: number;
  /** Total contributions made */
  totalContributions: number;
  /** Average contribution quality [0, 1] */
  avgContributionQuality: number;
  /** Communication reliability [0, 1] */
  reliability: number;
}

/**
 * Current client state
 */
export interface ClientState {
  /** Unique identifier */
  id: ClientId;
  /** Current availability */
  isAvailable: boolean;
  /** Data distribution metrics */
  dataDistribution: DataDistribution;
  /** Participation history */
  history: ParticipationHistory;
  /** Current system load [0, 1] */
  systemLoad: number;
  /** Network bandwidth estimate (Mbps) */
  networkBandwidth: number;
  /** Device compute capability score [0, 1] */
  computeCapability: number;
  /** Battery level [0, 1] (mobile devices) */
  batteryLevel?: number;
  /** Timestamp of last state update */
  lastUpdate: Date;
}

/**
 * Selection criteria weights
 */
export interface SelectionWeights {
  /** Weight for data quality */
  qualityWeight: number;
  /** Weight for data quantity */
  quantityWeight: number;
  /** Weight for reliability */
  reliabilityWeight: number;
  /** Weight for fairness/diversity */
  fairnessWeight: number;
  /** Weight for system resources */
  resourceWeight: number;
}

/**
 * Selection context
 */
export interface SelectionContext {
  /** Current round number */
  roundNumber: number;
  /** Target number of clients to select */
  targetCount: number;
  /** Minimum clients required */
  minClients: number;
  /** Maximum consecutive selections per client */
  maxConsecutiveSelections: number;
  /** Selection strategy to use */
  strategy: SelectionStrategy;
  /** Selection weights */
  weights: SelectionWeights;
  /** Required domains for stratified sampling */
  requiredDomains?: Set<string>;
  /** Required groups for fairness sampling */
  requiredGroups?: Set<string>;
}

/**
 * Selection strategy type
 */
export enum SelectionStrategy {
  /** Uniform random sampling */
  RANDOM_UNIFORM = 'random_uniform',
  /** Stratified sampling by data distribution */
  RANDOM_STRATIFIED = 'random_stratified',
  /** Importance sampling by quality */
  IMPORTANCE_QUALITY = 'importance_quality',
  /** Adaptive importance sampling */
  IMPORTANCE_ADAPTIVE = 'importance_adaptive',
  /** Fairness-aware sampling */
  FAIRNESS_DIVERSE = 'fairness_diverse',
  /** Fairness-aware with bias prevention */
  FAIRNESS_BIAS_PREVENTING = 'fairness_bias_preventing',
}

/**
 * Selection result
 */
export interface SelectionResult {
  /** Selected clients */
  selectedClients: ClientId[];
  /** Selection probabilities (for analysis) */
  selectionProbabilities: Map<ClientId, number>;
  /** Selection scores (for analysis) */
  selectionScores: Map<ClientId, number>;
  /** Fairness metrics */
  fairnessMetrics: FairnessMetrics;
  /** Stratification statistics (if applicable) */
  stratificationStats?: StratificationStats;
}

/**
 * Fairness metrics
 */
export interface FairnessMetrics {
  /** Gini coefficient of selection distribution [0, 1] */
  giniCoefficient: number;
  /** Representation error by group */
  representationError: Map<string, number>;
  /** Diversity score (Shannon entropy) */
  diversityScore: number;
  /** Selection bias score */
  selectionBias: number;
}

/**
 * Stratification statistics
 */
export interface StratificationStats {
  /** Distribution by domain */
  domainDistribution: Map<string, number>;
  /** Distribution by demographic group */
  groupDistribution: Map<string, number>;
  /** Distribution by data quantity tier */
  quantityDistribution: Map<string, number>;
}

// ============================================================================
// Client State Manager
// ============================================================================

/**
 * Manages client state tracking and updates
 */
export class ClientStateManager {
  private clients: Map<ClientId, ClientState>;

  constructor() {
    this.clients = new Map();
  }

  /**
   * Register a new client or update existing client
   */
  registerClient(state: ClientState): void {
    this.clients.set(state.id, { ...state });
  }

  /**
   * Update client availability
   */
  updateAvailability(clientId: ClientId, isAvailable: boolean): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAvailable = isAvailable;
      client.lastUpdate = new Date();
    }
  }

  /**
   * Update client participation history after a round
   */
  updateParticipation(
    clientId: ClientId,
    roundNumber: number,
    contributionQuality: number
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const history = client.history;
    history.totalSelections++;
    history.totalContributions++;

    // Update consecutive selections
    if (history.lastSelectionRound === roundNumber - 1) {
      history.consecutiveSelections++;
    } else {
      history.consecutiveSelections = 1;
    }
    history.lastSelectionRound = roundNumber;

    // Update average quality with exponential moving average
    const alpha = 0.3; // Smoothing factor
    history.avgContributionQuality =
      alpha * contributionQuality +
      (1 - alpha) * history.avgContributionQuality;
  }

  /**
   * Update client system metrics
   */
  updateSystemMetrics(
    clientId: ClientId,
    metrics: Partial<
      Pick<ClientState, 'systemLoad' | 'networkBandwidth' | 'computeCapability' | 'batteryLevel'>
    >
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    Object.assign(client, metrics);
    client.lastUpdate = new Date();
  }

  /**
   * Get client state
   */
  getClient(clientId: ClientId): ClientState | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all available clients
   */
  getAvailableClients(): ClientState[] {
    return Array.from(this.clients.values()).filter((c) => c.isAvailable);
  }

  /**
   * Get clients by domain
   */
  getClientsByDomain(domain: string): ClientState[] {
    return this.getAvailableClients().filter(
      (c) => c.dataDistribution.domain === domain
    );
  }

  /**
   * Get clients by group
   */
  getClientsByGroup(group: string): ClientState[] {
    return this.getAvailableClients().filter(
      (c) => c.dataDistribution.group === group
    );
  }

  /**
   * Get total number of registered clients
   */
  getTotalClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get number of available clients
   */
  getAvailableClientCount(): number {
    return this.getAvailableClients().length;
  }

  /**
   * Remove stale clients (not updated for threshold time)
   */
  removeStaleClients(thresholdMs: number): ClientId[] {
    const now = Date.now();
    const removed: ClientId[] = [];

    for (const [id, client] of this.clients.entries()) {
      const age = now - client.lastUpdate.getTime();
      if (age > thresholdMs) {
        this.clients.delete(id);
        removed.push(id);
      }
    }

    return removed;
  }

  /**
   * Clear all client state
   */
  clear(): void {
    this.clients.clear();
  }
}

// ============================================================================
// Base Selector
// ============================================================================

/**
 * Base class for client selection strategies
 */
export abstract class ClientSelector {
  protected stateManager: ClientStateManager;

  constructor(stateManager: ClientStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Select clients for the current round
   */
  abstract select(context: SelectionContext): SelectionResult;

  /**
   * Calculate selection score for a client
   */
  protected calculateScore(
    client: ClientState,
    weights: SelectionWeights
  ): number {
    const quality = client.dataDistribution.qualityScore;
    const quantity = Math.min(
      client.dataDistribution.sampleCount / 1000,
      1.0
    );
    const reliability = client.history.reliability;
    const resources =
      (1 - client.systemLoad) * 0.5 +
      client.networkBandwidth / 100 * 0.3 +
      client.computeCapability * 0.2;

    return (
      weights.qualityWeight * quality +
      weights.quantityWeight * quantity +
      weights.reliabilityWeight * reliability +
      weights.resourceWeight * resources
    );
  }

  /**
   * Check if client can be selected (consecutive selection limit)
   */
  protected canSelectClient(
    client: ClientState,
    context: SelectionContext
  ): boolean {
    if (!client.isAvailable) return false;
    if (client.systemLoad > 0.9) return false; // Overloaded
    if (client.batteryLevel !== undefined && client.batteryLevel < 0.2) {
      return false; // Low battery
    }

    return (
      client.history.consecutiveSelections < context.maxConsecutiveSelections
    );
  }

  /**
   * Calculate fairness metrics for selection result
   */
  protected calculateFairnessMetrics(
    selectedClients: ClientId[],
    allClients: ClientState[]
  ): FairnessMetrics {
    const metrics: FairnessMetrics = {
      giniCoefficient: 0,
      representationError: new Map(),
      diversityScore: 0,
      selectionBias: 0,
    };

    if (selectedClients.length === 0 || allClients.length === 0) {
      return metrics;
    }

    // Calculate Gini coefficient for selection distribution
    const selectionCounts = new Map<ClientId, number>();
    for (const client of allClients) {
      selectionCounts.set(client.id, client.history.totalSelections);
    }

    const counts = Array.from(selectionCounts.values());
    const n = counts.length;
    const sortedCounts = counts.sort((a, b) => a - b);

    let giniSum = 0;
    for (let i = 0; i < n; i++) {
      giniSum += (2 * (i + 1) - n - 1) * sortedCounts[i];
    }

    const totalSelections = sortedCounts.reduce((a, b) => a + b, 0);
    if (totalSelections > 0) {
      metrics.giniCoefficient = giniSum / (n * totalSelections);
    }

    // Calculate representation error by group
    const groupCounts = new Map<string, number>();
    const selectedGroupCounts = new Map<string, number>();

    for (const client of allClients) {
      const group = client.dataDistribution.group || 'default';
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    }

    for (const clientId of selectedClients) {
      const client = allClients.find((c) => c.id === clientId);
      if (client) {
        const group = client.dataDistribution.group || 'default';
        selectedGroupCounts.set(group, (selectedGroupCounts.get(group) || 0) + 1);
      }
    }

    for (const [group, count] of groupCounts.entries()) {
      const expected = count / allClients.length;
      const actual = (selectedGroupCounts.get(group) || 0) / selectedClients.length;
      metrics.representationError.set(group, Math.abs(expected - actual));
    }

    // Calculate diversity score (Shannon entropy of groups)
    const entropySum = selectedGroupCounts.size > 0
      ? Array.from(selectedGroupCounts.values()).reduce((sum, count) => {
          const p = count / selectedClients.length;
          return sum + p * Math.log(p);
        }, 0)
      : 0;
    metrics.diversityScore = -entropySum;

    // Calculate selection bias (correlation with quality score)
    const qualities = allClients.map((c) => c.dataDistribution.qualityScore);
    const meanQuality =
      qualities.reduce((a, b) => a + b, 0) / qualities.length;
    const selectedQualities = selectedClients
      .map((id) => allClients.find((c) => c.id === id))
      .filter((c) => c !== undefined)
      .map((c) => c!.dataDistribution.qualityScore);
    const meanSelectedQuality =
      selectedQualities.reduce((a, b) => a + b, 0) / selectedQualities.length;

    metrics.selectionBias = meanSelectedQuality - meanQuality;

    return metrics;
  }
}

// ============================================================================
// Random Sampling Strategies
// ============================================================================

/**
 * Uniform random sampling selector
 */
export class RandomUniformSelector extends ClientSelector {
  select(context: SelectionContext): SelectionResult {
    const availableClients = this.stateManager.getAvailableClients();
    const eligibleClients = availableClients.filter((c) =>
      this.canSelectClient(c, context)
    );

    // Shuffle and select
    const shuffled = eligibleClients.sort(() => Math.random() - 0.5);
    const selected = shuffled
      .slice(0, context.targetCount)
      .map((c) => c.id);

    const probabilities = new Map<ClientId, number>();
    for (const client of eligibleClients) {
      probabilities.set(client.id, 1 / eligibleClients.length);
    }

    const scores = new Map<ClientId, number>();
    for (const clientId of selected) {
      scores.set(clientId, 1.0);
    }

    return {
      selectedClients: selected,
      selectionProbabilities: probabilities,
      selectionScores: scores,
      fairnessMetrics: this.calculateFairnessMetrics(
        selected,
        availableClients
      ),
    };
  }
}

/**
 * Stratified random sampling selector
 * Ensures representation from different data domains
 */
export class RandomStratifiedSelector extends ClientSelector {
  select(context: SelectionContext): SelectionResult {
    const availableClients = this.stateManager.getAvailableClients();
    const eligibleClients = availableClients.filter((c) =>
      this.canSelectClient(c, context)
    );

    // Group clients by domain
    const domainGroups = new Map<string, ClientState[]>();
    for (const client of eligibleClients) {
      const domain = client.dataDistribution.domain || 'default';
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      domainGroups.get(domain)!.push(client);
    }

    const selected: ClientId[] = [];
    const probabilities = new Map<ClientId, number>();
    const scores = new Map<ClientId, number>();

    // Allocate slots to domains proportionally
    const domains = Array.from(domainGroups.keys());
    const slotsPerDomain = Math.ceil(context.targetCount / domains.length);

    for (const domain of domains) {
      const domainClients = domainGroups.get(domain)!;
      const domainSlots = Math.min(slotsPerDomain, domainClients.length);

      // Shuffle and select within domain
      const shuffled = domainClients.sort(() => Math.random() - 0.5);
      for (let i = 0; i < domainSlots; i++) {
        const client = shuffled[i];
        selected.push(client.id);
        scores.set(client.id, 1.0);
      }

      // Set equal probabilities within domain
      const prob = 1 / domainClients.length;
      for (const client of domainClients) {
        probabilities.set(client.id, prob);
      }
    }

    // Build stratification stats
    const domainDistribution = new Map<string, number>();
    const groupDistribution = new Map<string, number>();
    const quantityDistribution = new Map<string, number>();

    for (const clientId of selected) {
      const client = availableClients.find((c) => c.id === clientId);
      if (client) {
        const domain = client.dataDistribution.domain || 'default';
        domainDistribution.set(domain, (domainDistribution.get(domain) || 0) + 1);

        const group = client.dataDistribution.group || 'default';
        groupDistribution.set(group, (groupDistribution.get(group) || 0) + 1);

        const tier = this.getQuantityTier(client.dataDistribution.sampleCount);
        quantityDistribution.set(tier, (quantityDistribution.get(tier) || 0) + 1);
      }
    }

    return {
      selectedClients: selected,
      selectionProbabilities: probabilities,
      selectionScores: scores,
      fairnessMetrics: this.calculateFairnessMetrics(selected, availableClients),
      stratificationStats: {
        domainDistribution,
        groupDistribution,
        quantityDistribution,
      },
    };
  }

  private getQuantityTier(sampleCount: number): string {
    if (sampleCount < 100) return 'small';
    if (sampleCount < 1000) return 'medium';
    return 'large';
  }
}

// ============================================================================
// Importance Sampling Strategies
// ============================================================================

/**
 * Quality-based importance sampling selector
 * Selects clients with higher data quality
 */
export class ImportanceQualitySelector extends ClientSelector {
  select(context: SelectionContext): SelectionResult {
    const availableClients = this.stateManager.getAvailableClients();
    const eligibleClients = availableClients.filter((c) =>
      this.canSelectClient(c, context)
    );

    // Calculate quality scores
    const scores = new Map<ClientId, number>();
    const totalScore = eligibleClients.reduce((sum, client) => {
      const score = client.dataDistribution.qualityScore;
      scores.set(client.id, score);
      return sum + score;
    }, 0);

    // Calculate probabilities proportional to quality
    const probabilities = new Map<ClientId, number>();
    for (const [id, score] of scores.entries()) {
      probabilities.set(id, score / totalScore);
    }

    // Weighted random sampling without replacement
    const selected: ClientId[] = [];
    const remaining = [...eligibleClients];

    for (let i = 0; i < Math.min(context.targetCount, remaining.length); i++) {
      // Renormalize probabilities
      const remainingScore = remaining.reduce(
        (sum, c) => sum + scores.get(c.id)!,
        0
      );

      let rand = Math.random() * remainingScore;
      let selectedIndex = 0;

      for (let j = 0; j < remaining.length; j++) {
        rand -= scores.get(remaining[j].id)!;
        if (rand <= 0) {
          selectedIndex = j;
          break;
        }
      }

      const selectedClient = remaining.splice(selectedIndex, 1)[0];
      selected.push(selectedClient.id);
    }

    return {
      selectedClients: selected,
      selectionProbabilities: probabilities,
      selectionScores: scores,
      fairnessMetrics: this.calculateFairnessMetrics(selected, availableClients),
    };
  }
}

/**
 * Adaptive importance sampling selector
 * Adapts selection based on contribution history and system state
 */
export class ImportanceAdaptiveSelector extends ClientSelector {
  select(context: SelectionContext): SelectionResult {
    const availableClients = this.stateManager.getAvailableClients();
    const eligibleClients = availableClients.filter((c) =>
      this.canSelectClient(c, context)
    );

    // Calculate adaptive scores
    const scores = new Map<ClientId, number>();
    for (const client of eligibleClients) {
      const score = this.calculateAdaptiveScore(client, context);
      scores.set(client.id, score);
    }

    // Normalize scores to probabilities
    const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);
    const probabilities = new Map<ClientId, number>();
    for (const [id, score] of scores.entries()) {
      probabilities.set(id, totalScore > 0 ? score / totalScore : 0);
    }

    // Sort by score and select top clients
    const sorted = eligibleClients.sort(
      (a, b) => scores.get(b.id)! - scores.get(a.id)!
    );
    const selected = sorted
      .slice(0, context.targetCount)
      .map((c) => c.id);

    return {
      selectedClients: selected,
      selectionProbabilities: probabilities,
      selectionScores: scores,
      fairnessMetrics: this.calculateFairnessMetrics(selected, availableClients),
    };
  }

  private calculateAdaptiveScore(
    client: ClientState,
    context: SelectionContext
  ): number {
    const weights = context.weights;
    const baseScore = this.calculateScore(client, weights);

    // Adaptive boost: penalize over-selected clients
    const consecutivePenalty =
      client.history.consecutiveSelections * 0.1;
    const totalPenalty = Math.log(client.history.totalSelections + 1) * 0.05;

    // Reliability bonus
    const reliabilityBonus = client.history.reliability * 0.2;

    // Recent performance bonus
    const performanceBonus = client.history.avgContributionQuality * 0.15;

    return (
      baseScore * (1 - consecutivePenalty - totalPenalty) +
      reliabilityBonus +
      performanceBonus
    );
  }
}

// ============================================================================
// Fairness-Aware Sampling Strategies
// ============================================================================

/**
 * Diverse fairness-aware sampling selector
 * Ensures diverse representation across groups
 */
export class FairnessDiverseSelector extends ClientSelector {
  select(context: SelectionContext): SelectionResult {
    const availableClients = this.stateManager.getAvailableClients();
    const eligibleClients = availableClients.filter((c) =>
      this.canSelectClient(c, context)
    );

    // Group clients by demographic group
    const groupGroups = new Map<string, ClientState[]>();
    for (const client of eligibleClients) {
      const group = client.dataDistribution.group || 'default';
      if (!groupGroups.has(group)) {
        groupGroups.set(group, []);
      }
      groupGroups.get(group)!.push(client);
    }

    const selected: ClientId[] = [];
    const scores = new Map<ClientId, number>();
    const probabilities = new Map<ClientId, number>();

    // Allocate slots to ensure minimum representation
    const groups = Array.from(groupGroups.keys());
    const minPerGroup = Math.max(1, Math.floor(context.targetCount / groups.length / 2));
    const remainingSlots = context.targetCount - minPerGroup * groups.length;

    // Select minimum from each group
    for (const group of groups) {
      const groupClients = groupGroups.get(group)!;
      const shuffled = groupClients.sort(() => Math.random() - 0.5);
      const toSelect = Math.min(minPerGroup, groupClients.length);

      for (let i = 0; i < toSelect; i++) {
        const client = shuffled[i];
        selected.push(client.id);
        scores.set(client.id, 1.0);
        probabilities.set(client.id, 1.0 / groupClients.length);
      }
    }

    // Fill remaining slots with quality-weighted selection
    if (remainingSlots > 0) {
      const remainingClients = eligibleClients.filter(
        (c) => !selected.includes(c.id)
      );

      const qualityScores = remainingClients.map((c) => ({
        client: c,
        score: c.dataDistribution.qualityScore,
      }));

      qualityScores.sort((a, b) => b.score - a.score);
      const additional = qualityScores
        .slice(0, remainingSlots)
        .map((qs) => qs.client.id);

      selected.push(...additional);
    }

    return {
      selectedClients: selected,
      selectionProbabilities: probabilities,
      selectionScores: scores,
      fairnessMetrics: this.calculateFairnessMetrics(selected, availableClients),
    };
  }
}

/**
 * Bias-preventing fairness-aware sampling selector
 * Actively prevents selection bias across rounds
 */
export class FairnessBiasPreventingSelector extends ClientSelector {
  private selectionHistory: Map<ClientId, number[]> = new Map();

  select(context: SelectionContext): SelectionResult {
    const availableClients = this.stateManager.getAvailableClients();
    const eligibleClients = availableClients.filter((c) =>
      this.canSelectClient(c, context)
    );

    // Calculate fairness scores (inverse of selection frequency)
    const fairnessScores = new Map<ClientId, number>();
    for (const client of eligibleClients) {
      const history = this.selectionHistory.get(client.id) || [];
      const selectionRate =
        history.length > 0
          ? history.reduce((a, b) => a + b, 0) / history.length
          : 0;

      // Lower selection rate -> higher fairness score
      const fairnessBoost = Math.max(0, 1 - selectionRate * 2);
      const qualityScore = client.dataDistribution.qualityScore;

      // Combine quality and fairness
      const combinedScore =
        qualityScore * 0.5 + fairnessBoost * 0.5;
      fairnessScores.set(client.id, combinedScore);
    }

    // Select by combined scores
    const sorted = eligibleClients.sort(
      (a, b) => fairnessScores.get(b.id)! - fairnessScores.get(a.id)!
    );

    const selected = sorted
      .slice(0, context.targetCount)
      .map((c) => c.id);

    // Update selection history AFTER selection
    for (const client of availableClients) {
      if (!this.selectionHistory.has(client.id)) {
        this.selectionHistory.set(client.id, []);
      }
      const history = this.selectionHistory.get(client.id)!;
      history.push(
        selected.includes(client.id) ? 1 : 0
      );
      // Keep only recent history (last 20 rounds)
      if (history.length > 20) {
        history.shift();
      }
    }

    const probabilities = new Map<ClientId, number>();
    for (const [id, score] of fairnessScores.entries()) {
      probabilities.set(id, score);
    }

    return {
      selectedClients: selected,
      selectionProbabilities: probabilities,
      selectionScores: fairnessScores,
      fairnessMetrics: this.calculateFairnessMetrics(selected, availableClients),
    };
  }
}

// ============================================================================
// Selector Factory
// ============================================================================

/**
 * Factory for creating client selectors
 */
export class SelectorFactory {
  static create(
    strategy: SelectionStrategy,
    stateManager: ClientStateManager
  ): ClientSelector {
    switch (strategy) {
      case SelectionStrategy.RANDOM_UNIFORM:
        return new RandomUniformSelector(stateManager);
      case SelectionStrategy.RANDOM_STRATIFIED:
        return new RandomStratifiedSelector(stateManager);
      case SelectionStrategy.IMPORTANCE_QUALITY:
        return new ImportanceQualitySelector(stateManager);
      case SelectionStrategy.IMPORTANCE_ADAPTIVE:
        return new ImportanceAdaptiveSelector(stateManager);
      case SelectionStrategy.FAIRNESS_DIVERSE:
        return new FairnessDiverseSelector(stateManager);
      case SelectionStrategy.FAIRNESS_BIAS_PREVENTING:
        return new FairnessBiasPreventingSelector(stateManager);
      default:
        throw new Error(`Unknown selection strategy: ${strategy}`);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a default selection context
 */
export function createDefaultContext(
  roundNumber: number,
  targetCount: number
): SelectionContext {
  return {
    roundNumber,
    targetCount,
    minClients: Math.max(1, Math.floor(targetCount / 2)),
    maxConsecutiveSelections: 3,
    strategy: SelectionStrategy.RANDOM_UNIFORM,
    weights: {
      qualityWeight: 0.3,
      quantityWeight: 0.2,
      reliabilityWeight: 0.2,
      fairnessWeight: 0.15,
      resourceWeight: 0.15,
    },
  };
}

/**
 * Create a client state from minimal information
 */
export function createClientState(
  id: ClientId,
  sampleCount: number,
  options: Partial<ClientState> = {}
): ClientState {
  return {
    id,
    isAvailable: true,
    dataDistribution: {
      sampleCount,
      classDistribution: new Map(),
      qualityScore: options.dataDistribution?.qualityScore ?? 0.8,
      domain: options.dataDistribution?.domain,
      group: options.dataDistribution?.group,
    },
    history: {
      totalSelections: 0,
      consecutiveSelections: 0,
      totalContributions: 0,
      avgContributionQuality: 0.8,
      reliability: 0.9,
    },
    systemLoad: options.systemLoad ?? 0.3,
    networkBandwidth: options.networkBandwidth ?? 50,
    computeCapability: options.computeCapability ?? 0.7,
    batteryLevel: options.batteryLevel,
    lastUpdate: new Date(),
  };
}
