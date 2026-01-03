/**
 * ByzantineEnsemble - Byzantine-Resilient Ensemble for Privacy-Preserving Inference
 *
 * Implements an ensemble system that queries multiple models and aggregates
 * their responses using Byzantine fault-tolerant voting. The ensemble can
 * tolerate faulty or malicious models while providing privacy-preserving
 * query splitting for sensitive data.
 *
 * @package @lsi/privacy
 */

import type {
  PrivacyLevel,
  QueryType,
  IntentCategory,
  Urgency,
} from "@lsi/protocol";
import {
  VotingMechanism,
  type IndividualResponse,
  type VotingResult,
} from "./VotingMechanism.js";
import { FaultDetector, type FaultReport } from "./FaultDetector.js";

/**
 * Voting mechanism types
 */
export type VotingMechanismType =
  | "majority" // Simple majority voting
  | "supermajority" // 2/3 majority required
  | "weighted" // Weighted by reputation
  | "median" // Median of scores
  | "trimmed_mean" // Trimmed mean (remove outliers)
  | "byzantine"; // Byzantine fault tolerance

/**
 * Query constraints
 */
export interface QueryConstraints {
  /** Maximum latency in milliseconds */
  maxLatency?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum cost in tokens */
  maxCost?: number;
  /** Privacy level required */
  privacyLevel?: PrivacyLevel;
}

/**
 * Conversation context
 */
export interface ConversationContext {
  /** Conversation ID */
  conversationId?: string;
  /** Previous messages */
  history?: Array<{ role: string; content: string }>;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
}

/**
 * Ensemble configuration
 */
export interface EnsembleConfig {
  /** Number of models in ensemble */
  size: number;
  /** Minimum votes needed for quorum */
  quorum: number;
  /** Maximum number of faulty Byzantine models */
  maxFaultyModels: number;
  /** Assume at least this many honest models */
  assumeHonest: number;

  /** Voting mechanism to use */
  votingMechanism: VotingMechanismType;
  /** Consensus threshold (0-1) */
  consensusThreshold: number;

  /** Enable privacy features */
  enablePrivacy: boolean;
  /** Split data across models for privacy */
  privateSplitting: boolean;

  /** Fallback behavior */
  fallbackOnQuorum: boolean;
  /** Fallback model if quorum not reached */
  fallbackModel?: string;

  /** Model query timeout in milliseconds */
  queryTimeout: number;
}

/**
 * Ensemble request
 */
export interface EnsembleRequest {
  /** Query text */
  query: string;
  /** Query type */
  queryType?: QueryType;
  /** Intent category */
  intent?: IntentCategory;
  /** Urgency level */
  urgency?: Urgency;

  /** Conversation context */
  context?: ConversationContext;

  /** Privacy level */
  privacyLevel?: PrivacyLevel;

  /** Query constraints */
  constraints?: QueryConstraints;

  /** Specific models to query (optional) */
  modelIds?: string[];
}

/**
 * Ensemble response
 */
export interface EnsembleResponse {
  /** Individual responses from each model */
  individualResponses: IndividualResponse[];

  /** Aggregated response text */
  aggregatedResponse: string;
  /** Overall confidence (0-1) */
  confidence: number;

  /** Voting results */
  votingResult: VotingResult;

  /** Detected faulty models */
  faultyModels: string[];
  /** Honest models */
  honestModels: string[];

  /** Whether privacy was preserved */
  privacyPreserved: boolean;

  /** Total latency in milliseconds */
  totalLatency: number;
  /** Whether quorum was reached */
  quorumReached: boolean;

  /** Fallback was used */
  usedFallback: boolean;
}

/**
 * Model interface for querying individual models
 */
export interface ModelAdapter {
  /** Model identifier */
  modelId: string;

  /**
   * Query the model
   *
   * @param query - Query text
   * @param context - Optional conversation context
   * @returns Promise with response text and confidence
   */
  query(
    query: string,
    context?: ConversationContext
  ): Promise<{
    response: string;
    confidence: number;
    latency: number;
  }>;
}

/**
 * ByzantineEnsemble - Main ensemble class
 *
 * Queries multiple models in parallel, detects faulty responses,
 * and aggregates results using Byzantine fault-tolerant voting.
 */
export class ByzantineEnsemble {
  private config: EnsembleConfig;
  private votingMechanism: VotingMechanism;
  private faultDetector: FaultDetector;
  private models: Map<string, ModelAdapter> = new Map();

  constructor(config: Partial<EnsembleConfig> = {}) {
    this.config = {
      size: 5,
      quorum: 3,
      maxFaultyModels: 1,
      assumeHonest: 3,
      votingMechanism: "byzantine",
      consensusThreshold: 0.6,
      enablePrivacy: true,
      privateSplitting: false,
      fallbackOnQuorum: true,
      queryTimeout: 30000,
      ...config,
    };

    this.votingMechanism = new VotingMechanism();
    this.faultDetector = new FaultDetector();
  }

  /**
   * Register a model adapter
   *
   * @param adapter - Model adapter to register
   */
  registerModel(adapter: ModelAdapter): void {
    this.models.set(adapter.modelId, adapter);
  }

  /**
   * Unregister a model adapter
   *
   * @param modelId - Model identifier to remove
   */
  unregisterModel(modelId: string): void {
    this.models.delete(modelId);
  }

  /**
   * Query the ensemble
   *
   * Sends queries to all registered models in parallel,
   * detects faults, and aggregates responses using voting.
   *
   * @param request - Ensemble request
   * @returns Ensemble response with aggregated result
   */
  async query(request: EnsembleRequest): Promise<EnsembleResponse> {
    const startTime = Date.now();

    // Determine which models to query
    const modelIds = request.modelIds || Array.from(this.models.keys());

    if (modelIds.length === 0) {
      throw new Error("No models available for ensemble query");
    }

    // Split query for privacy if enabled
    const queryMap = this.config.privateSplitting
      ? this.splitQuery(request.query, modelIds)
      : this.distributeQuery(request.query, modelIds);

    // Query all models in parallel
    const individualResponses = await this.queryModels(
      queryMap,
      request.context
    );

    // Detect faulty models
    const faultReports = this.faultDetector.detectFaults(individualResponses);

    // Filter out faulty models if configured
    const honestResponses = individualResponses.filter(
      r => !faultReports.find(f => f.modelId === r.modelId && f.isFaulty)
    );

    const faultyModels = faultReports
      .filter(f => f.isFaulty)
      .map(f => f.modelId);

    const honestModels = Array.from(this.models.keys()).filter(
      id => !faultyModels.includes(id)
    );

    // Vote on responses
    const votingResult = this.vote(
      honestResponses.length > 0 ? honestResponses : individualResponses
    );

    // Aggregate responses
    const { response, confidence } = this.aggregateResponses(
      honestResponses.length > 0 ? honestResponses : individualResponses,
      votingResult
    );

    // Check quorum
    const quorumReached = votingResult.totalVotes >= this.config.quorum;

    // Use fallback if quorum not reached and configured
    let usedFallback = false;
    let finalResponse = response;
    let finalConfidence = confidence;

    if (
      !quorumReached &&
      this.config.fallbackOnQuorum &&
      this.config.fallbackModel
    ) {
      const fallbackAdapter = this.models.get(this.config.fallbackModel);
      if (fallbackAdapter) {
        try {
          const fallbackResult = await Promise.race([
            fallbackAdapter.query(request.query, request.context),
            this.timeoutAfter(this.config.queryTimeout),
          ]);

          finalResponse = fallbackResult.response;
          finalConfidence = fallbackResult.confidence;
          usedFallback = true;
        } catch {
          // Fallback failed, use ensemble result
        }
      }
    }

    const totalLatency = Date.now() - startTime;

    // Update reputations based on voting
    this.updateReputations(individualResponses, votingResult);

    return {
      individualResponses,
      aggregatedResponse: finalResponse,
      confidence: finalConfidence,
      votingResult,
      faultyModels,
      honestModels,
      privacyPreserved:
        this.config.privateSplitting ||
        request.privacyLevel === undefined ||
        request.privacyLevel === "public",
      totalLatency,
      quorumReached,
      usedFallback,
    };
  }

  /**
   * Split query across models for privacy
   *
   * Divides the query into parts that are sent to different models.
   * No single model sees the complete query.
   *
   * @param query - Original query
   * @param modelIds - Model identifiers
   * @returns Map of model IDs to query parts
   */
  private splitQuery(query: string, modelIds: string[]): Map<string, string> {
    const queryMap = new Map<string, string>();

    // Split query into chunks
    const words = query.split(/\s+/);
    const chunkSize = Math.ceil(words.length / modelIds.length);

    for (let i = 0; i < modelIds.length; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, words.length);
      const chunk = words.slice(start, end).join(" ");

      queryMap.set(modelIds[i], chunk);
    }

    return queryMap;
  }

  /**
   * Distribute same query to all models
   *
   * @param query - Query text
   * @param modelIds - Model identifiers
   * @returns Map of model IDs to query
   */
  private distributeQuery(
    query: string,
    modelIds: string[]
  ): Map<string, string> {
    const queryMap = new Map<string, string>();
    for (const modelId of modelIds) {
      queryMap.set(modelId, query);
    }
    return queryMap;
  }

  /**
   * Query all models in parallel
   *
   * @param queryMap - Map of model IDs to queries
   * @param context - Conversation context
   * @returns Array of individual responses
   */
  private async queryModels(
    queryMap: Map<string, string>,
    context?: ConversationContext
  ): Promise<IndividualResponse[]> {
    const responses: IndividualResponse[] = [];

    const queries = Array.from(queryMap.entries()).map(
      async ([modelId, query]) => {
        const model = this.models.get(modelId);
        if (!model) {
          return {
            modelId,
            response: "",
            confidence: 0,
            latency: 0,
            error: "Model not found",
          };
        }

        const startTime = Date.now();

        try {
          const result = await Promise.race([
            model.query(query, context),
            this.timeoutAfter(this.config.queryTimeout),
          ]);

          const latency = Date.now() - startTime;

          return {
            modelId,
            response: result.response,
            confidence: result.confidence,
            latency,
          };
        } catch (error) {
          const latency = Date.now() - startTime;
          return {
            modelId,
            response: "",
            confidence: 0,
            latency,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    );

    const results = await Promise.all(queries);
    responses.push(...results);

    return responses;
  }

  /**
   * Aggregate responses using voting
   *
   * @param responses - Individual responses
   * @returns Aggregated response and confidence
   */
  private aggregateResponses(
    responses: IndividualResponse[],
    votingResult: VotingResult
  ): { response: string; confidence: number } {
    if (responses.length === 0 || !votingResult.winningResponse) {
      return { response: "", confidence: 0 };
    }

    // Calculate weighted confidence from voting participants
    const winnerResponses = responses.filter(
      r =>
        this.votingMechanism["hashResponse"](r.response) === votingResult.winner
    );

    const avgConfidence =
      winnerResponses.reduce((sum, r) => sum + r.confidence, 0) /
      winnerResponses.length;

    return {
      response: votingResult.winningResponse,
      confidence: avgConfidence * votingResult.consensusLevel,
    };
  }

  /**
   * Vote on responses using configured mechanism
   *
   * @param responses - Individual responses
   * @returns Voting result
   */
  private vote(responses: IndividualResponse[]): VotingResult {
    switch (this.config.votingMechanism) {
      case "majority":
        return this.votingMechanism.majority(responses);

      case "supermajority":
        return this.votingMechanism.supermajority(responses);

      case "weighted":
        return this.votingMechanism.weighted(responses);

      case "median":
        return this.votingMechanism.median(responses);

      case "trimmed_mean":
        return this.votingMechanism.trimmedMean(responses);

      case "byzantine":
        return this.votingMechanism.byzantine(
          responses,
          this.config.maxFaultyModels
        );

      default:
        return this.votingMechanism.majority(responses);
    }
  }

  /**
   * Update model reputations based on voting results
   *
   * Models that voted with the winner gain reputation,
   * models that voted against lose reputation.
   *
   * @param responses - Individual responses
   * @param votingResult - Result of voting
   */
  private updateReputations(
    responses: IndividualResponse[],
    votingResult: VotingResult
  ): void {
    // Update reputation for each model
    for (const response of responses) {
      const responseHash = this.votingMechanism["hashResponse"](
        response.response
      );
      const votedWithWinner = responseHash === votingResult.winner;

      this.votingMechanism.updateReputation(response.modelId, votedWithWinner);
    }
  }

  /**
   * Create a timeout promise
   *
   * @param ms - Timeout in milliseconds
   * @returns Promise that rejects after timeout
   */
  private timeoutAfter(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Get voting mechanism instance
   *
   * @returns Voting mechanism
   */
  getVotingMechanism(): VotingMechanism {
    return this.votingMechanism;
  }

  /**
   * Get fault detector instance
   *
   * @returns Fault detector
   */
  getFaultDetector(): FaultDetector {
    return this.faultDetector;
  }

  /**
   * Get ensemble configuration
   *
   * @returns Current configuration
   */
  getConfig(): EnsembleConfig {
    return { ...this.config };
  }

  /**
   * Update ensemble configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<EnsembleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get registered model IDs
   *
   * @returns Array of model IDs
   */
  getModelIds(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Get number of registered models
   *
   * @returns Number of models
   */
  getModelCount(): number {
    return this.models.size;
  }
}
