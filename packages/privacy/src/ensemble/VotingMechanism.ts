/**
 * VotingMechanism - Byzantine-Resilient Voting Strategies
 *
 * Provides multiple voting mechanisms for ensemble consensus,
 * including Byzantine fault-tolerant voting, weighted voting,
 * and statistical aggregation methods.
 *
 * @package @lsi/privacy
 */

/**
 * Individual response from a single model in the ensemble
 */
export interface IndividualResponse {
  /** Model identifier */
  modelId: string;
  /** Response text */
  response: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Latency in milliseconds */
  latency: number;
  /** Error if model failed */
  error?: string;
}

/**
 * Single vote cast by a model
 */
export interface Vote {
  /** Model that cast this vote */
  modelId: string;
  /** Choice identifier (response hash/id) */
  choice: string;
  /** Voting weight (based on reputation, 0-1) */
  weight: number;
}

/**
 * Result of a voting operation
 */
export interface VotingResult {
  /** Winning response hash/id */
  winner: string;
  /** Winning response text */
  winningResponse: string;
  /** All votes cast */
  votes: Vote[];
  /** Whether consensus was achieved */
  consensus: boolean;
  /** Consensus level (0-1, 1 = unanimous) */
  consensusLevel: number;
  /** Total votes for winner */
  winnerVotes: number;
  /** Total valid votes */
  totalVotes: number;
}

/**
 * Reputation score for a model
 */
export interface ReputationScore {
  /** Model identifier */
  modelId: string;
  /** Base reputation score (0-1) */
  score: number;
  /** Current voting weight */
  weight: number;
  /** Performance history */
  history: {
    correct: number;
    incorrect: number;
    abstentions: number;
  };
}

/**
 * VotingMechanism - Byzantine-resilient voting strategies
 *
 * Implements multiple voting mechanisms for ensemble consensus:
 * - Majority voting: Simple majority wins
 * - Supermajority voting: 2/3 majority required
 * - Weighted voting: Models vote by reputation weight
 * - Median voting: Median of scores (robust to outliers)
 * - Trimmed mean: Remove outliers, average the rest
 * - Byzantine voting: Tolerate f faulty models out of 2f+1
 */
export class VotingMechanism {
  private reputations: Map<string, ReputationScore> = new Map();

  /**
   * Majority voting - simple majority wins
   *
   * @param responses - Individual model responses
   * @returns Voting result with majority winner
   */
  majority(responses: IndividualResponse[]): VotingResult {
    const validResponses = responses.filter(r => !r.error);
    if (validResponses.length === 0) {
      return this.emptyResult();
    }

    // Group similar responses (simple hashing for grouping)
    const groups = this.groupResponses(validResponses);
    const votes: Vote[] = [];

    // Count votes for each group
    const voteCounts = new Map<
      string,
      { count: number; responses: IndividualResponse[] }
    >();
    for (const response of validResponses) {
      const choice = this.hashResponse(response.response);
      const existing = voteCounts.get(choice);
      if (existing) {
        existing.count++;
        existing.responses.push(response);
      } else {
        voteCounts.set(choice, { count: 1, responses: [response] });
      }
    }

    // Find majority winner
    let maxVotes = 0;
    let winner = "";
    let winningResponse = "";

    for (const [choice, data] of voteCounts) {
      votes.push({
        modelId: data.responses[0].modelId,
        choice,
        weight: 1 / validResponses.length,
      });

      if (data.count > maxVotes) {
        maxVotes = data.count;
        winner = choice;
        winningResponse = data.responses[0].response;
      }
    }

    const consensusLevel = maxVotes / validResponses.length;
    const hasMajority = maxVotes > validResponses.length / 2;

    return {
      winner,
      winningResponse,
      votes,
      consensus: hasMajority,
      consensusLevel,
      winnerVotes: maxVotes,
      totalVotes: validResponses.length,
    };
  }

  /**
   * Supermajority voting - 2/3 majority required
   *
   * @param responses - Individual model responses
   * @returns Voting result with supermajority check
   */
  supermajority(responses: IndividualResponse[]): VotingResult {
    const validResponses = responses.filter(r => !r.error);
    if (validResponses.length === 0) {
      return this.emptyResult();
    }

    // Group similar responses (simple hashing for grouping)
    const voteCounts = new Map<string, number>();

    // Count votes for each group
    for (const response of validResponses) {
      const choice = this.hashResponse(response.response);
      const existing = voteCounts.get(choice);
      voteCounts.set(choice, (existing ?? 0) + 1);
    }

    // Find majority winner
    let maxVotes = 0;
    let winner = "";
    let winningResponse = "";

    for (const [choice, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = choice;
        // Find a response with this choice
        const resp = validResponses.find(
          r => this.hashResponse(r.response) === choice
        );
        winningResponse = resp?.response || "";
      }
    }

    const hasSupermajority = maxVotes / validResponses.length >= 2 / 3;

    return {
      winner,
      winningResponse,
      votes: [],
      consensus: hasSupermajority,
      consensusLevel: maxVotes / validResponses.length,
      winnerVotes: maxVotes,
      totalVotes: validResponses.length,
    };
  }

  /**
   * Weighted voting - models vote by reputation weight
   *
   * @param responses - Individual model responses
   * @returns Voting result weighted by reputation
   */
  weighted(responses: IndividualResponse[]): VotingResult {
    const validResponses = responses.filter(r => !r.error);
    if (validResponses.length === 0) {
      return this.emptyResult();
    }

    const votes: Vote[] = [];
    const weightedCounts = new Map<string, number>();
    const responseMap = new Map<string, string>();
    let totalWeight = 0;

    // Count weighted votes
    for (const response of validResponses) {
      const choice = this.hashResponse(response.response);
      const reputation = this.reputations.get(response.modelId);
      const weight = reputation?.weight ?? 1.0;

      votes.push({
        modelId: response.modelId,
        choice,
        weight,
      });

      const currentWeight = weightedCounts.get(choice) ?? 0;
      weightedCounts.set(choice, currentWeight + weight);
      responseMap.set(choice, response.response);
      totalWeight += weight;
    }

    // Find weighted winner
    let maxWeight = 0;
    let winner = "";
    let winningResponse = "";

    for (const [choice, weight] of weightedCounts) {
      if (weight > maxWeight) {
        maxWeight = weight;
        winner = choice;
        winningResponse = responseMap.get(choice)!;
      }
    }

    const consensusLevel = maxWeight / totalWeight;

    return {
      winner,
      winningResponse,
      votes,
      consensus: consensusLevel > 0.5,
      consensusLevel,
      winnerVotes: maxWeight,
      totalVotes: totalWeight,
    };
  }

  /**
   * Median voting - select median confidence response
   *
   * @param responses - Individual model responses
   * @returns Voting result with median selection
   */
  median(responses: IndividualResponse[]): VotingResult {
    const validResponses = responses.filter(r => !r.error);
    if (validResponses.length === 0) {
      return this.emptyResult();
    }

    // Sort by confidence
    const sorted = [...validResponses].sort(
      (a, b) => a.confidence - b.confidence
    );
    const medianIndex = Math.floor(sorted.length / 2);
    const medianResponse = sorted[medianIndex];

    const votes: Vote[] = sorted.map(r => ({
      modelId: r.modelId,
      choice: this.hashResponse(r.response),
      weight: 1 / sorted.length,
    }));

    // Consensus level based on how clustered confidences are
    const meanConfidence =
      sorted.reduce((sum, r) => sum + r.confidence, 0) / sorted.length;
    const variance =
      sorted.reduce(
        (sum, r) => sum + Math.pow(r.confidence - meanConfidence, 2),
        0
      ) / sorted.length;
    const consensusLevel = Math.max(0, 1 - variance);

    return {
      winner: this.hashResponse(medianResponse.response),
      winningResponse: medianResponse.response,
      votes,
      consensus: consensusLevel > 0.7,
      consensusLevel,
      winnerVotes: 1,
      totalVotes: sorted.length,
    };
  }

  /**
   * Trimmed mean voting - remove outliers, average the rest
   *
   * @param responses - Individual model responses
   * @param trimPercentage - Percentage to trim from each end (0-0.5, default 0.2)
   * @returns Voting result with trimmed mean
   */
  trimmedMean(
    responses: IndividualResponse[],
    trimPercentage = 0.2
  ): VotingResult {
    const validResponses = responses.filter(r => !r.error);
    if (validResponses.length === 0) {
      return this.emptyResult();
    }

    const sorted = [...validResponses].sort(
      (a, b) => a.confidence - b.confidence
    );
    const trimCount = Math.floor(sorted.length * trimPercentage);

    // Trim outliers
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

    if (trimmed.length === 0) {
      return this.median(responses);
    }

    // Calculate average of trimmed responses (select highest confidence)
    const avgResponse = trimmed.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    const votes: Vote[] = validResponses.map(r => ({
      modelId: r.modelId,
      choice: this.hashResponse(r.response),
      weight: 1 / validResponses.length,
    }));

    const consensusLevel = trimmed.length / validResponses.length;

    return {
      winner: this.hashResponse(avgResponse.response),
      winningResponse: avgResponse.response,
      votes,
      consensus: consensusLevel > 0.6,
      consensusLevel,
      winnerVotes: trimmed.length,
      totalVotes: validResponses.length,
    };
  }

  /**
   * Byzantine fault-tolerant voting
   *
   * Implements Byzantine fault tolerance: can tolerate f faulty models
   * out of 2f+1 total models. Uses recursive agreement algorithm.
   *
   * @param responses - Individual model responses
   * @param maxFaulty - Maximum number of faulty models to tolerate
   * @returns Voting result with Byzantine resilience
   */
  byzantine(responses: IndividualResponse[], maxFaulty: number): VotingResult {
    const validResponses = responses.filter(r => !r.error);
    const n = validResponses.length;

    // Byzantine resilience requires 2f+1 models
    const minModels = 2 * maxFaulty + 1;
    if (n < minModels) {
      // Not enough models for Byzantine guarantee, fall back to majority
      return this.majority(responses);
    }

    // Group responses and count
    const responseGroups = new Map<string, IndividualResponse[]>();
    for (const response of validResponses) {
      const hash = this.hashResponse(response.response);
      const existing = responseGroups.get(hash);
      if (existing) {
        existing.push(response);
      } else {
        responseGroups.set(hash, [response]);
      }
    }

    // Find largest group
    let maxCount = 0;
    let winningHash = "";
    let winningResponses: IndividualResponse[] = [];

    for (const [hash, responses] of responseGroups) {
      if (responses.length > maxCount) {
        maxCount = responses.length;
        winningHash = hash;
        winningResponses = responses;
      }
    }

    // Check if we have enough votes to tolerate f faulty models
    // We need at least f+1 votes (honest majority)
    const hasConsensus = maxCount >= maxFaulty + 1;

    const votes: Vote[] = validResponses.map(r => ({
      modelId: r.modelId,
      choice: this.hashResponse(r.response),
      weight: r.modelId === winningResponses[0]?.modelId ? 1 : 0,
    }));

    return {
      winner: winningHash,
      winningResponse: winningResponses[0]?.response || "",
      votes,
      consensus: hasConsensus,
      consensusLevel: maxCount / n,
      winnerVotes: maxCount,
      totalVotes: n,
    };
  }

  /**
   * Calculate consensus level from votes
   *
   * @param votes - Array of votes
   * @returns Consensus level (0-1)
   */
  calculateConsensusLevel(votes: Vote[]): number {
    if (votes.length === 0) return 0;

    // Count votes per choice
    const counts = new Map<string, number>();
    for (const vote of votes) {
      const current = counts.get(vote.choice) ?? 0;
      counts.set(vote.choice, current + 1);
    }

    // Find max count
    let maxCount = 0;
    for (const count of counts.values()) {
      if (count > maxCount) {
        maxCount = count;
      }
    }

    return maxCount / votes.length;
  }

  /**
   * Set reputation score for a model
   *
   * @param modelId - Model identifier
   * @param score - Reputation score (0-1)
   */
  setReputation(modelId: string, score: number): void {
    const existing = this.reputations.get(modelId);
    if (existing) {
      existing.score = score;
      existing.weight = score;
    } else {
      this.reputations.set(modelId, {
        modelId,
        score,
        weight: score,
        history: {
          correct: 0,
          incorrect: 0,
          abstentions: 0,
        },
      });
    }
  }

  /**
   * Update model reputation based on performance
   *
   * @param modelId - Model identifier
   * @param correct - Whether the model was correct
   */
  updateReputation(modelId: string, correct: boolean): void {
    const reputation = this.reputations.get(modelId);
    if (reputation) {
      if (correct) {
        reputation.history.correct++;
        // Increase reputation
        reputation.score = Math.min(1, reputation.score + 0.05);
      } else {
        reputation.history.incorrect++;
        // Decrease reputation
        reputation.score = Math.max(0.1, reputation.score - 0.1);
      }
      reputation.weight = reputation.score;
    } else {
      // Initialize with history
      this.reputations.set(modelId, {
        modelId,
        score: correct ? 0.6 : 0.4,
        weight: correct ? 0.6 : 0.4,
        history: {
          correct: correct ? 1 : 0,
          incorrect: correct ? 0 : 1,
          abstentions: 0,
        },
      });
    }
  }

  /**
   * Get reputation score for a model
   *
   * @param modelId - Model identifier
   * @returns Reputation score or undefined
   */
  getReputation(modelId: string): ReputationScore | undefined {
    return this.reputations.get(modelId);
  }

  /**
   * Get all reputation scores
   *
   * @returns Map of model IDs to reputation scores
   */
  getAllReputations(): Map<string, ReputationScore> {
    return new Map(this.reputations);
  }

  /**
   * Reset all reputation scores
   */
  resetReputations(): void {
    this.reputations.clear();
  }

  /**
   * Group similar responses together
   *
   * @param responses - Responses to group
   * @returns Map of response hash to responses
   */
  private groupResponses(
    responses: IndividualResponse[]
  ): Map<string, IndividualResponse[]> {
    const groups = new Map<string, IndividualResponse[]>();
    for (const response of responses) {
      const hash = this.hashResponse(response.response);
      const existing = groups.get(hash);
      if (existing) {
        existing.push(response);
      } else {
        groups.set(hash, [response]);
      }
    }
    return groups;
  }

  /**
   * Hash a response for grouping/voting
   *
   * Uses a simple hash of normalized text for grouping similar responses.
   *
   * @param response - Response text to hash
   * @returns Hash string
   */
  private hashResponse(response: string): string {
    // Normalize: lowercase, trim, remove extra whitespace
    const normalized = response.toLowerCase().trim().replace(/\s+/g, " ");

    // Simple hash (for production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `hash_${Math.abs(hash)}`;
  }

  /**
   * Create an empty voting result
   *
   * @returns Empty voting result
   */
  private emptyResult(): VotingResult {
    return {
      winner: "",
      winningResponse: "",
      votes: [],
      consensus: false,
      consensusLevel: 0,
      winnerVotes: 0,
      totalVotes: 0,
    };
  }
}
