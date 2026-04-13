/**
 * @file task-board.ts - CRDT-based task board for multi-agent coordination
 * @module @lsi/fleet-collab/task-board
 *
 * Agents can create, claim, and complete tasks without conflicts.
 * Uses LWW-Map per task + OR-Set for task index to guarantee convergence.
 */

import {
  Task, TaskStatus, TaskPriority, AgentId,
  type CollabEvent, CollabEventType, type EventListener,
} from './types.js';
import { LWWMap, LWWRegister } from './crdt-primitives.js';

export class TaskBoard {
  /** Key: taskId, Value: LWWRegister<Task> */
  private tasks: LWWMap = new LWWMap();
  /** Event listeners */
  private listeners: Set<EventListener> = new Set();
  /** The replica (agent) owning this board instance */
  private replicaId: AgentId;

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
  }

  // ------------------------------------------------------------------
  // TASK OPERATIONS
  // ------------------------------------------------------------------

  /** Create a new task */
  createTask(title: string, description: string, priority: TaskPriority, opts?: {
    tags?: string[];
    dependencies?: string[];
    id?: string;
  }): Task {
    const id = opts?.id || `task:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const task: Task = {
      id,
      title,
      description,
      status: TaskStatus.PENDING,
      priority,
      createdBy: this.replicaId,
      createdAt: now,
      updatedAt: now,
      tags: opts?.tags || [],
      dependencies: opts?.dependencies || [],
      metadata: {},
    };
    this.tasks.set(id, task, this.replicaId);
    this.emit({ type: CollabEventType.TASK_CREATED, agentId: this.replicaId, timestamp: now, payload: { task } });
    return task;
  }

  /** Claim a task (only if PENDING or CLAIMED by same agent) */
  claimTask(taskId: string, agentId: AgentId): Task | null {
    const task = this.getTask(taskId);
    if (!task) return null;
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.CLAIMED) return null;
    if (task.claimedBy && task.claimedBy !== agentId) return null;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: TaskStatus.CLAIMED,
      claimedBy: agentId,
      claimedAt: now,
      updatedAt: now,
    };
    this.tasks.set(taskId, updated, agentId);
    this.emit({ type: CollabEventType.TASK_CLAIMED, agentId, timestamp: now, payload: { task: updated } });
    return updated;
  }

  /** Start working on a claimed task */
  startTask(taskId: string, agentId: AgentId): Task | null {
    const task = this.getTask(taskId);
    if (!task || task.claimedBy !== agentId) return null;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: TaskStatus.IN_PROGRESS,
      updatedAt: now,
    };
    this.tasks.set(taskId, updated, agentId);
    return updated;
  }

  /** Complete a task */
  completeTask(taskId: string, agentId: AgentId, result?: string): Task | null {
    const task = this.getTask(taskId);
    if (!task || task.claimedBy !== agentId) return null;
    if (task.status === TaskStatus.COMPLETED) return null;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: TaskStatus.COMPLETED,
      completedBy: agentId,
      completedAt: now,
      updatedAt: now,
      metadata: { ...task.metadata, ...(result ? { result } : {}) },
    };
    this.tasks.set(taskId, updated, agentId);
    this.emit({ type: CollabEventType.TASK_COMPLETED, agentId, timestamp: now, payload: { task: updated } });
    return updated;
  }

  /** Fail a task */
  failTask(taskId: string, agentId: AgentId, reason?: string): Task | null {
    const task = this.getTask(taskId);
    if (!task || task.claimedBy !== agentId) return null;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: TaskStatus.FAILED,
      updatedAt: now,
      metadata: { ...task.metadata, ...(reason ? { failReason: reason } : {}) },
    };
    this.tasks.set(taskId, updated, agentId);
    this.emit({ type: CollabEventType.TASK_FAILED, agentId, timestamp: now, payload: { task: updated } });
    return updated;
  }

  /** Cancel a task */
  cancelTask(taskId: string, agentId: AgentId): Task | null {
    const task = this.getTask(taskId);
    if (!task) return null;
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) return null;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: TaskStatus.CANCELLED,
      updatedAt: now,
    };
    this.tasks.set(taskId, updated, agentId);
    this.emit({ type: CollabEventType.TASK_CANCELLED, agentId, timestamp: now, payload: { task: updated } });
    return updated;
  }

  // ------------------------------------------------------------------
  // QUERIES
  // ------------------------------------------------------------------

  getTask(taskId: string): Task | null {
    const val = this.tasks.get(taskId);
    if (val === undefined || val === null) return null;
    return val as Task;
  }

  getAllTasks(): Task[] {
    return this.tasks.entries_list()
      .map(([, v]) => v as Task)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter(t => t.status === status);
  }

  getTasksByPriority(priority: TaskPriority): Task[] {
    return this.getAllTasks().filter(t => t.priority === priority);
  }

  getTasksByAgent(agentId: AgentId): Task[] {
    return this.getAllTasks().filter(t => t.claimedBy === agentId);
  }

  getAvailableTasks(): Task[] {
    const completedIds = new Set(
      this.getTasksByStatus(TaskStatus.COMPLETED).map(t => t.id)
    );
    return this.getAllTasks().filter(t =>
      t.status === TaskStatus.PENDING &&
      t.dependencies.every(dep => completedIds.has(dep))
    );
  }

  // ------------------------------------------------------------------
  // MERGE (CRDT reconciliation)
  // ------------------------------------------------------------------

  /** Merge another task board's state into this one */
  merge(other: TaskBoard): number {
    this.tasks.merge(other.tasks);
    return this.tasks.size();
  }

  /** Export full state for network sync */
  exportState(): Record<string, unknown> {
    return this.tasks.toJSON();
  }

  /** Import state from another replica */
  importState(data: Record<string, unknown>): void {
    this.tasks = LWWMap.fromJSON(data as any);
  }

  // ------------------------------------------------------------------
  // EVENTS
  // ------------------------------------------------------------------

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: CollabEvent): void {
    for (const l of this.listeners) {
      try { l(event); } catch (_) { /* swallow listener errors */ }
    }
  }
}
