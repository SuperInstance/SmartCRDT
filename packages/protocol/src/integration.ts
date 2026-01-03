/**
 * @lsi/protocol - Integration Types for Cross-Package Communication
 *
 * This module defines protocol interfaces for cross-package integration,
 * particularly for training, shadow logging, and superinstance components.
 *
 * @module integration
 */

// ============================================================================
// TRAINING INTEGRATION TYPES
// ============================================================================

/**
 * Training status
 */
export enum TrainingStatus {
  IDLE = "idle",
  PREPARING = "preparing",
  TRAINING = "training",
  EVALUATING = "evaluating",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * LoRA adapter configuration
 */
export interface LoRAConfig {
  /** LoRA rank (typically 4-64) */
  r: number;
  /** LoRA alpha (scaling factor) */
  alpha: number;
  /** Dropout rate */
  dropout: number;
  /** Target modules to apply LoRA */
  targetModules: string[];
  /** Bias mode */
  bias: "none" | "all" | "lora_only";
}

/**
 * ORPO training configuration
 */
export interface ORPOTrainingConfig {
  /** Base model to fine-tune */
  baseModel: string;
  /** LoRA configuration */
  lora: LoRAConfig;
  /** Training epochs */
  epochs: number;
  /** Batch size */
  batchSize: number;
  /** Learning rate */
  learningRate: number;
  /** ORPO beta parameter (odds ratio weight) */
  beta: number;
  /** Maximum sequence length */
  maxSequenceLength: number;
  /** Device to train on ('cpu' or 'cuda') */
  device: "cpu" | "cuda";
  /** Output directory for trained adapter */
  outputDir: string;
  /** Logging directory */
  loggingDir: string;
  /** Save steps (checkpoint frequency) */
  saveSteps: number;
  /** Eval steps (evaluation frequency) */
  evalSteps: number;
  /** Warmup ratio */
  warmupRatio: number;
  /** Weight decay */
  weightDecay: number;
}

/**
 * Curriculum training configuration
 */
export interface CurriculumTrainingConfig {
  /** Base model for curriculum training */
  baseModel: string;
  /** LoRA configuration */
  lora: LoRAConfig;
  /** Curriculum stages in order of difficulty */
  stages: CurriculumStage[];
  /** Maximum sequence length */
  maxSequenceLength: number;
  /** Device to train on ('cpu' or 'cuda') */
  device: "cpu" | "cuda";
  /** Output directory for trained adapter */
  outputDir: string;
  /** Logging directory */
  loggingDir: string;
  /** Save steps (checkpoint frequency) */
  saveSteps: number;
  /** Eval steps (evaluation frequency) */
  evalSteps: number;
  /** Warmup ratio */
  warmupRatio: number;
  /** Weight decay */
  weightDecay: number;
  /** Overall training epochs */
  epochs: number;
  /** Batch size */
  batchSize: number;
  /** Learning rate */
  learningRate: number;
  /** ORPO beta parameter (odds ratio weight) */
  beta: number;
}

/**
 * Single stage in curriculum training
 */
export interface CurriculumStage {
  /** Stage identifier */
  id: string;
  /** Stage description */
  description: string;
  /** Difficulty level (1-10) */
  difficulty: number;
  /** Training epochs for this stage */
  epochs: number;
  /** Batch size for this stage */
  batchSize: number;
  /** Learning rate for this stage */
  learningRate: number;
  /** Custom curriculum data for this stage */
  curriculumData?: any;
  /** Prerequisites (stage IDs) */
  prerequisites?: string[];
}

/**
 * Training checkpoint
 */
export interface TrainingCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Step number */
  step: number;
  /** Epoch number */
  epoch: number;
  /** Training loss */
  trainingLoss: number;
  /** Evaluation loss */
  evalLoss?: number;
  /** Adapter weights path */
  adapterPath: string;
  /** Checkpoint directory */
  checkpointDir: string;
}

/**
 * Training metrics
 */
export interface TrainingMetrics {
  /** Current step */
  step: number;
  /** Current epoch */
  epoch: number;
  /** Total steps */
  totalSteps: number;
  /** Training loss */
  trainingLoss: number;
  /** Evaluation loss */
  evalLoss?: number;
  /** Learning rate */
  learningRate: number;
  /** Epoch progress (0-1) */
  epochProgress: number;
  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining?: number;
  /** GPU memory usage (MB) */
  gpuMemoryUsage?: number;
}

/**
 * Training event
 */
export interface TrainingEvent {
  /** Event type */
  type:
    | "start"
    | "progress"
    | "checkpoint"
    | "eval"
    | "complete"
    | "error"
    | "cancel";
  /** Timestamp */
  timestamp: number;
  /** Training ID */
  trainingId: string;
  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * Training progress callback
 */
export type TrainingProgressCallback = (metrics: TrainingMetrics) => void;

/**
 * Training event callback
 */
export type TrainingEventCallback = (event: TrainingEvent) => void;

// ============================================================================
// SHADOW LOGGING INTEGRATION TYPES
// ============================================================================

// Import privacy types from atp-acp to avoid duplicates
import { PrivacyLevel, PIIType } from "./atp-acp.js";

/**
 * Privacy classification levels
 * @deprecated Import from @lsi/protocol/atp-acp instead
 */
export { PrivacyLevel, PIIType };

/**
 * Privacy classification result
 */
export interface PrivacyClassification {
  /** Overall privacy level */
  level: PrivacyLevel;
  /** Detected PII instances */
  piiDetected: PIIDetection[];
  /** Whether content is safe to log */
  safeToLog: boolean;
  /** Reason for classification */
  reason: string;
  /** Detected regulatory contexts (e.g., HIPAA, GDPR) */
  regulatoryContext?: string[];
}

/**
 * Detected PII with location information
 */
export interface PIIDetection {
  /** Type of PII detected */
  type: PIIType;
  /** Start index in text */
  start: number;
  /** End index in text */
  end: number;
  /** Original value (for redaction) */
  value: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Shadow log entry
 */
export interface ShadowLogEntry {
  /** Unique entry ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Timestamp */
  timestamp: number;
  /** Query metadata */
  query: QueryMetadata;
  /** Response metadata */
  response: ResponseMetadata;
  /** User feedback rating (1-5, optional) */
  userRating?: number;
  /** Whether user accepted this response */
  userAccepted?: boolean;
  /** Alternative response (for A/B testing) */
  alternativeResponse?: {
    /** Alternative content */
    content: string;
    /** Backend/model used */
    backend: "local" | "cloud";
    model: string;
    /** Generation latency (ms) */
    latency: number;
    /** Cost (USD) */
    cost?: number;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Query execution metadata
 */
export interface QueryMetadata {
  /** Query timestamp */
  timestamp: number;
  /** Query text (may be redacted) */
  query: string;
  /** Intent classification */
  intent: string;
  /** Intent confidence */
  intentConfidence: number;
  /** Query complexity */
  complexity: number;
  /** Backend used (local/cloud) */
  backend: "local" | "cloud";
  /** Model used */
  model: string;
  /** Routing decision confidence */
  routingConfidence: number;
  /** Execution latency (ms) */
  latency: number;
  /** Token usage */
  tokensUsed?: number;
  /** Cost (USD) */
  cost?: number;
  /** Privacy classification */
  privacy: PrivacyClassification;
  /** Query category */
  category: string;
  /** Query subcategory */
  subcategory: string;
  /** Session ID for grouping related queries */
  sessionId?: string;
  /** User ID (hashed) */
  userId?: string;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Response timestamp */
  timestamp: number;
  /** Response content (may be redacted) */
  content: string;
  /** Backend used */
  backend: "local" | "cloud";
  /** Model used */
  model: string;
  /** Generation latency (ms) */
  latency: number;
  /** Tokens generated */
  tokensGenerated?: number;
  /** Whether response was from cache */
  fromCache?: boolean;
  /** Finish reason */
  finishReason?: string;
  /** Cost (USD) */
  cost?: number;
  /** Privacy classification */
  privacy: PrivacyClassification;
}



/**
 * Preference pair for ORPO training
 */
export interface PreferencePair {
  /** Unique pair ID */
  id: string;
  /** Query text (redacted if needed) */
  query: string;
  /** Chosen response (preferred by user) */
  chosen: {
    /** Response content */
    content: string;
    /** Backend/model */
    backend: "local" | "cloud";
    model: string;
    /** Why this was chosen */
    reason: string;
  };
  /** Rejected response (not preferred) */
  rejected: {
    /** Response content */
    content: string;
    /** Backend/model */
    backend: "local" | "cloud";
    model: string;
    /** Why this was rejected */
    reason: string;
  };
  /** Metadata about the preference */
  metadata: {
    /** Timestamp */
    timestamp: number;
    /** User rating difference */
    ratingDifference?: number;
    /** Latency difference (ms) */
    latencyDifference?: number;
    /** Cost difference (USD) */
    costDifference?: number;
    /** Privacy level */
    privacyLevel: PrivacyLevel;
    /** Quality score */
    qualityScore: number;
  };
}

// ============================================================================
// SUPERINSTANCE INTEGRATION TYPES
// ============================================================================

/**
 * ContextPlane interface for knowledge and context management
 */
export interface IContextPlane {
  /**
   * Initialize the context plane
   */
  initialize(): Promise<void>;

  /**
   * Store knowledge item
   */
  storeKnowledge(item: { key: string; value: any }): Promise<void>;

  /**
   * Retrieve knowledge by key
   */
  retrieveKnowledge(
    key: string
  ): Promise<{ key: string; value: any } | undefined>;

  /**
   * Retrieve context for a query
   */
  retrieveContext(options: { query: string }): Promise<{
    knowledge: any[];
    embeddings: number[][];
  }>;

  /**
   * Extract domains from a query
   */
  extractDomains(query: string): Promise<string[]>;

  /**
   * Extract detailed domain classification from text
   */
  extractDomainClassification(text: string): Promise<any>;

  /**
   * Tag knowledge entry with domains
   */
  tagWithDomain(entry: any): Promise<any>;

  /**
   * Build embedding for text
   */
  buildEmbedding(text: string): Promise<number[]>;

  /**
   * Shutdown the context plane
   */
  shutdown(): Promise<void>;
}

/**
 * IntentionPlane interface for query routing and intent encoding
 */
export interface IIntentionPlane {
  /**
   * Initialize the intention plane
   */
  initialize(): Promise<void>;

  /**
   * Route a query to appropriate backend
   */
  route(options: { query: string; intent: string }): Promise<{
    backend: string;
    confidence: number;
  }>;

  /**
   * Classify query intent
   */
  classify(query: string): Promise<{ intent: string; confidence: number }>;

  /**
   * Encode query intent for privacy-preserving routing
   */
  encodeIntent?(
    query: string,
    epsilon?: number
  ): Promise<import("./atp-acp.js").IntentVector | null>;

  /**
   * Batch encode intents
   */
  encodeBatch?(
    queries: string[],
    epsilon?: number
  ): Promise<import("./atp-acp.js").IntentVector[]>;

  /**
   * Execute a query
   */
  execute?(
    query: string,
    backend?: "local" | "cloud" | "hybrid"
  ): Promise<import("./common.js").ExecutionResult>;

  /**
   * Shutdown the intention plane
   */
  shutdown(): Promise<void>;
}

/**
 * LucidDreamer interface for learning and improvement
 */
export interface ILucidDreamer {
  /**
   * Initialize LucidDreamer
   */
  initialize(): Promise<void>;

  /**
   * Log a query/response pair for learning
   */
  logInteraction(entry: {
    query: string;
    queryMetadata: QueryMetadata;
    response: string;
    responseMetadata: ResponseMetadata;
    userId?: string;
    sessionId?: string;
    userRating?: number;
    userAccepted?: boolean;
  }): Promise<string>;

  /**
   * Generate preference pairs for ORPO training
   */
  generatePreferencePairs(): Promise<PreferencePair[]>;

  /**
   * Generate hypothesis for improvement
   */
  generateHypothesis(options: { observation: string }): Promise<{
    hypothesis: string;
    confidence: number;
  }>;

  /**
   * Train a new LoRA adapter
   */
  trainAdapter(options: {
    adapterName?: string;
    description?: string;
    minPreferencePairs?: number;
    progressCallback?: TrainingProgressCallback;
  }): Promise<{ adapterId: string; status: string }>;

  /**
   * Deploy a trained adapter
   */
  deployAdapter(
    adapterId: string,
    options?: { skipShadowTest?: boolean; skipSafetyCheck?: boolean }
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Rollback to previous adapter
   */
  rollbackAdapter(
    toAdapterId?: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Shutdown LucidDreamer
   */
  shutdown(): Promise<void>;
}

/**
 * SuperInstance configuration
 */
export interface ISuperInstanceConfig {
  contextPlane?: {
    knowledgeStore?: any;
  };
  intentionPlane?: {
    router?: any;
    enableReasoning?: boolean;
  };
  lucidDreamer?: {
    enabled?: boolean;
  };
}

/**
 * SuperInstance main orchestration interface
 */
export interface ISuperInstance {
  /** Context plane */
  contextPlane: IContextPlane;
  /** Intention plane */
  intentionPlane: IIntentionPlane;
  /** LucidDreamer */
  lucidDreamer: ILucidDreamer;

  /**
   * Initialize the superinstance
   */
  initialize(): Promise<void>;

  /**
   * Execute a query
   */
  query(query: string): Promise<{
    content: string;
    error?: string;
    metadata?: any;
  }>;

  /**
   * Shutdown the superinstance
   */
  shutdown(): Promise<void>;
}
