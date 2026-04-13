/**
 * @file crdt-store.ts - Unified CRDT store for fleet collaboration
 * @module @lsi/fleet-collab/crdt-store
 *
 * Central store that combines all CRDT-based collaboration components.
 * Handles serialization, merging, and provides a unified interface.
 */

import { AgentId, type FleetSummary, CrdtKind, type MergeResult } from './types.js';
import { TaskBoard } from './task-board.js';
import { KnowledgeBase } from './knowledge-base.js';
import { FleetState } from './fleet-state.js';
import { MetricsAggregator } from './metrics.js';
import { ConfigRegistry } from './config-registry.js';
import { MembershipRegistry } from './membership.js';
import type { CollabEvent, EventListener } from './types.js';

export class FleetCollabStore {
  readonly taskBoard: TaskBoard;
  readonly knowledgeBase: KnowledgeBase;
  readonly fleetState: FleetState;
  readonly metrics: MetricsAggregator;
  readonly config: ConfigRegistry;
  readonly membership: MembershipRegistry;

  private replicaId: AgentId;
  private globalListeners: Set<EventListener> = new Set();

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
    this.taskBoard = new TaskBoard(replicaId);
    this.knowledgeBase = new KnowledgeBase(replicaId);
    this.fleetState = new FleetState(replicaId);
    this.metrics = new MetricsAggregator(replicaId);
    this.config = new ConfigRegistry(replicaId);
    this.membership = new MembershipRegistry(replicaId);

    // Forward all sub-component events to global listeners
    for (const sub of [this.taskBoard, this.knowledgeBase, this.fleetState, this.config, this.membership] as any[]) {
      sub.on((event: CollabEvent) => this.forwardEvent(event));
    }
  }

  // ------------------------------------------------------------------
  // UNIFIED MERGE
  // ------------------------------------------------------------------

  /** Merge another store's full state into this one */
  merge(other: FleetCollabStore): MergeResult {
    const before = this.getSnapshot();

    this.taskBoard.merge(other.taskBoard);
    this.knowledgeBase.merge(other.knowledgeBase);
    this.fleetState.merge(other.fleetState);
    this.metrics.merge(other.metrics);
    this.config.merge(other.config);
    this.membership.merge(other.membership);

    const after = this.getSnapshot();

    return {
      merged: true,
      conflictsDetected: 0,
      conflictsResolved: 0,
      keysAffected: Math.abs(after.totalAgents - before.totalAgents) +
        Math.abs(after.totalTasks - before.totalTasks) +
        Math.abs(after.totalKnowledgeEntries - before.totalKnowledgeEntries),
    };
  }

  // ------------------------------------------------------------------
  // FULL SNAPSHOT
  // ------------------------------------------------------------------

  getSnapshot(): FleetSummary {
    const tasks = this.taskBoard.getAllTasks();
    return this.fleetState.getSummary({
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending' as any).length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress' as any).length,
      completedTasks: tasks.filter(t => t.status === 'completed' as any).length,
    });
  }

  /** Export entire store state */
  exportAll(): {
    tasks: Record<string, unknown>;
    knowledge: Record<string, unknown>;
    fleetState: ReturnType<FleetState['exportState']>;
    metrics: ReturnType<MetricsAggregator['exportState']>;
    config: Record<string, unknown>;
    membership: ReturnType<MembershipRegistry['exportState']>;
    replicaId: AgentId;
    exportedAt: number;
  } {
    return {
      tasks: this.taskBoard.exportState(),
      knowledge: this.knowledgeBase.exportState(),
      fleetState: this.fleetState.exportState(),
      metrics: this.metrics.exportState(),
      config: this.config.exportState(),
      membership: this.membership.exportState(),
      replicaId: this.replicaId,
      exportedAt: Date.now(),
    };
  }

  /** Import entire store state */
  importAll(data: {
    tasks?: Record<string, unknown>;
    knowledge?: Record<string, unknown>;
    fleetState?: ReturnType<FleetState['exportState']>;
    metrics?: ReturnType<MetricsAggregator['exportState']>;
    config?: Record<string, unknown>;
    membership?: ReturnType<MembershipRegistry['exportState']>;
  }): void {
    if (data.tasks) this.taskBoard.importState(data.tasks);
    if (data.knowledge) this.knowledgeBase.importState(data.knowledge);
    if (data.fleetState) this.fleetState.importState(data.fleetState);
    if (data.metrics) this.metrics.importState(data.metrics);
    if (data.config) this.config.importState(data.config);
    if (data.membership) this.membership.importState(data.membership);
  }

  // ------------------------------------------------------------------
  // EVENTS
  // ------------------------------------------------------------------

  /** Subscribe to all events from all sub-components */
  onGlobal(listener: EventListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  private forwardEvent(event: CollabEvent): void {
    for (const l of this.globalListeners) {
      try { l(event); } catch (_) { /* swallow */ }
    }
  }

  getReplicaId(): AgentId {
    return this.replicaId;
  }
}
