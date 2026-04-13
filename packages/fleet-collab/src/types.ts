/**
 * @file types.ts - Type definitions for the fleet collaboration layer
 * @module @lsi/fleet-collab/types
 */

// ============================================================================
// AGENT TYPES
// ============================================================================

/** Unique agent identifier */
export type AgentId = string;

/** Task priority levels */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/** Task status lifecycle */
export enum TaskStatus {
  PENDING = 'pending',
  CLAIMED = 'claimed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/** Agent status in the fleet */
export enum AgentStatus {
  ONLINE = 'online',
  BUSY = 'busy',
  IDLE = 'idle',
  OFFLINE = 'offline',
  ERROR = 'error'
}

/** Task definition for the CRDT task board */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: AgentId;
  claimedBy?: AgentId;
  completedBy?: AgentId;
  createdAt: number;
  updatedAt: number;
  claimedAt?: number;
  completedAt?: number;
  tags: string[];
  dependencies: string[]; // task IDs this task depends on
  metadata: Record<string, unknown>;
}

/** Knowledge entry contributed by an agent */
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  createdBy: AgentId;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  confidence: number; // 0.0 - 1.0
  source?: string;
  metadata: Record<string, unknown>;
}

/** Fleet member representation */
export interface FleetMember {
  agentId: AgentId;
  agentName: string;
  status: AgentStatus;
  capabilities: string[];
  currentTask?: string;
  lastSeen: number;
  joinedAt: number;
  metadata: Record<string, unknown>;
}

/** Metric entry for aggregation */
export interface MetricEntry {
  agentId: AgentId;
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

/** Fleet configuration entry */
export interface ConfigEntry {
  key: string;
  value: unknown;
  updatedAt: number;
  updatedBy: AgentId;
}

// ============================================================================
// CRDT STATE TYPES
// ============================================================================

/** Serializable CRDT state snapshot */
export interface CRDTStateSnapshot {
  type: CrdtKind;
  payload: unknown;
  version: number;
  replicaId: AgentId;
  timestamp: number;
}

/** Supported CRDT kinds */
export enum CrdtKind {
  G_COUNTER = 'g_counter',
  PN_COUNTER = 'pn_counter',
  LWW_REGISTER = 'lww_register',
  OR_SET = 'or_set',
  LWW_MAP = 'lww_map',
  TASK_BOARD = 'task_board',
  KNOWLEDGE_BASE = 'knowledge_base',
  FLEET_STATE = 'fleet_state'
}

/** Merge result for multi-replica reconciliation */
export interface MergeResult {
  merged: boolean;
  conflictsDetected: number;
  conflictsResolved: number;
  keysAffected: number;
}

/** Fleet state summary */
export interface FleetSummary {
  totalAgents: number;
  onlineAgents: number;
  busyAgents: number;
  idleAgents: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  totalKnowledgeEntries: number;
  metricsCount: number;
}

// ============================================================================
// API TYPES
// ============================================================================

/** HTTP API request base */
export interface ApiRequest {
  agentId: AgentId;
  timestamp: number;
}

/** Task creation request */
export interface CreateTaskRequest extends ApiRequest {
  title: string;
  description: string;
  priority: TaskPriority;
  tags?: string[];
  dependencies?: string[];
}

/** Task claim request */
export interface ClaimTaskRequest extends ApiRequest {
  taskId: string;
}

/** Task completion request */
export interface CompleteTaskRequest extends ApiRequest {
  taskId: string;
  result?: string;
}

/** Knowledge contribution request */
export interface ContributeKnowledgeRequest extends ApiRequest {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  confidence?: number;
  source?: string;
}

/** Metric report request */
export interface ReportMetricRequest extends ApiRequest {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

/** Agent heartbeat request */
export interface HeartbeatRequest {
  agentId: AgentId;
  agentName: string;
  status: AgentStatus;
  capabilities: string[];
  currentTask?: string;
}

/** Config update request */
export interface UpdateConfigRequest extends ApiRequest {
  key: string;
  value: unknown;
}

/** Generic API response */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/** Merge request from another replica */
export interface MergeRequest {
  fromReplica: AgentId;
  crdtType: CrdtKind;
  state: CRDTStateSnapshot;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export enum CollabEventType {
  TASK_CREATED = 'task_created',
  TASK_CLAIMED = 'task_claimed',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_CANCELLED = 'task_cancelled',
  KNOWLEDGE_CONTRIBUTED = 'knowledge_contributed',
  KNOWLEDGE_UPDATED = 'knowledge_updated',
  AGENT_JOINED = 'agent_joined',
  AGENT_LEFT = 'agent_left',
  AGENT_STATUS_CHANGED = 'agent_status_changed',
  CONFIG_UPDATED = 'config_updated',
  METRIC_REPORTED = 'metric_reported',
  STATE_MERGED = 'state_merged'
}

export interface CollabEvent {
  type: CollabEventType;
  agentId?: AgentId;
  timestamp: number;
  payload: Record<string, unknown>;
}

export type EventListener = (event: CollabEvent) => void;
