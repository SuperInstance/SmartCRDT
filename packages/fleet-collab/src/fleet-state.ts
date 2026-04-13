/**
 * @file fleet-state.ts - CRDT-based fleet state tracking
 * @module @lsi/fleet-collab/fleet-state
 *
 * Tracks who's working on what, last seen times, capabilities, and agent status.
 * Uses LWW-Map per agent + OR-Set for membership.
 */

import {
  FleetMember, AgentId, AgentStatus,
  type CollabEvent, CollabEventType, type EventListener, type FleetSummary,
} from './types.js';
import { LWWMap, ORSet } from './crdt-primitives.js';
import { GCounter } from './crdt-primitives.js';
import { TaskStatus } from './types.js';

export class FleetState {
  /** agentId -> LWWRegister<FleetMember> */
  private members: LWWMap = new LWWMap();
  /** OR-Set of active agent IDs for membership tracking */
  private membership: ORSet<string> = new ORSet();
  /** G-Counter: total heartbeats received per agent */
  private heartbeats: GCounter = new GCounter();
  private listeners: Set<EventListener> = new Set();
  private replicaId: AgentId;

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
  }

  /** Register or update an agent in the fleet */
  updateAgent(agentId: AgentId, updates: Partial<Pick<FleetMember, 'agentName' | 'status' | 'capabilities' | 'currentTask'>>): FleetMember {
    const existing = this.getMember(agentId);
    const now = Date.now();
    const member: FleetMember = {
      agentId,
      agentName: updates.agentName || existing?.agentName || agentId,
      status: updates.status || existing?.status || AgentStatus.ONLINE,
      capabilities: updates.capabilities || existing?.capabilities || [],
      currentTask: updates.currentTask ?? existing?.currentTask,
      lastSeen: now,
      joinedAt: existing?.joinedAt || now,
      metadata: existing?.metadata || {},
    };

    this.members.set(agentId, member, this.replicaId);
    this.membership.add(agentId, this.replicaId);
    this.heartbeats.increment(agentId);

    const isNew = !existing;
    if (isNew) {
      this.emit({ type: CollabEventType.AGENT_JOINED, agentId, timestamp: now, payload: { member } });
    } else if (existing && existing.status !== member.status) {
      this.emit({ type: CollabEventType.AGENT_STATUS_CHANGED, agentId, timestamp: now, payload: { oldStatus: existing.status, newStatus: member.status } });
    }

    return member;
  }

  /** Record a heartbeat (just updates lastSeen) */
  heartbeat(agentId: AgentId, opts?: { status?: AgentStatus; currentTask?: string }): FleetMember | null {
    const existing = this.getMember(agentId);
    if (!existing) return null;

    const now = Date.now();
    const member: FleetMember = {
      ...existing,
      lastSeen: now,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.currentTask !== undefined ? { currentTask: opts.currentTask } : {}),
    };
    this.members.set(agentId, member, this.replicaId);
    this.heartbeats.increment(agentId);
    return member;
  }

  /** Remove an agent from the fleet */
  removeAgent(agentId: AgentId): void {
    this.members.delete(agentId, this.replicaId);
    this.membership.remove(agentId);
    this.emit({ type: CollabEventType.AGENT_LEFT, agentId, timestamp: Date.now(), payload: {} });
  }

  /** Mark agents as offline if they haven't been seen within threshold ms */
  evictStaleAgents(thresholdMs: number): string[] {
    const now = Date.now();
    const evicted: string[] = [];
    for (const m of this.getMembers()) {
      if (now - m.lastSeen > thresholdMs && m.status !== AgentStatus.OFFLINE) {
        const updated = this.updateAgent(m.agentId, { status: AgentStatus.OFFLINE });
        if (updated.status === AgentStatus.OFFLINE) evicted.push(m.agentId);
      }
    }
    return evicted;
  }

  // ------------------------------------------------------------------
  // QUERIES
  // ------------------------------------------------------------------

  getMember(agentId: AgentId): FleetMember | null {
    const val = this.members.get(agentId);
    if (val === undefined || val === null) return null;
    return val as FleetMember;
  }

  getMembers(): FleetMember[] {
    return this.members.entries_list()
      .map(([, v]) => v as FleetMember)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  getMembersByStatus(status: AgentStatus): FleetMember[] {
    return this.getMembers().filter(m => m.status === status);
  }

  getMembersByCapability(capability: string): FleetMember[] {
    return this.getMembers().filter(m => m.capabilities.includes(capability));
  }

  getOnlineAgents(): FleetMember[] {
    return this.getMembers().filter(m => m.status !== AgentStatus.OFFLINE && m.status !== AgentStatus.ERROR);
  }

  /** Find idle agents with the given capabilities */
  findAvailableAgents(requiredCapabilities: string[]): FleetMember[] {
    return this.getMembers().filter(m =>
      m.status === AgentStatus.IDLE &&
      requiredCapabilities.every(c => m.capabilities.includes(c))
    );
  }

  /** Check membership */
  isMember(agentId: AgentId): boolean {
    return this.membership.has(agentId);
  }

  getMemberCount(): number {
    return this.membership.size();
  }

  /** Get total heartbeat count */
  getTotalHeartbeats(): number {
    return this.heartbeats.value();
  }

  /** Generate a summary of the fleet state */
  getSummary(taskInfo?: { totalTasks: number; pendingTasks: number; inProgressTasks: number; completedTasks: number }): FleetSummary {
    const members = this.getMembers();
    const onlineCount = members.filter(m => m.status === AgentStatus.ONLINE || m.status === AgentStatus.IDLE).length;
    const busyCount = members.filter(m => m.status === AgentStatus.BUSY || m.status === AgentStatus.IN_PROGRESS).length;
    const idleCount = members.filter(m => m.status === AgentStatus.IDLE).length;

    return {
      totalAgents: members.length,
      onlineAgents: onlineCount,
      busyAgents: busyCount,
      idleAgents: idleCount,
      totalTasks: taskInfo?.totalTasks || 0,
      pendingTasks: taskInfo?.pendingTasks || 0,
      inProgressTasks: taskInfo?.inProgressTasks || 0,
      completedTasks: taskInfo?.completedTasks || 0,
      totalKnowledgeEntries: 0,
      metricsCount: 0,
    };
  }

  // ------------------------------------------------------------------
  // MERGE
  // ------------------------------------------------------------------

  merge(other: FleetState): void {
    this.members.merge(other.members);
    this.membership.merge(other.membership);
    this.heartbeats.merge(other.heartbeats);
  }

  exportState(): { members: Record<string, unknown>; membership: unknown; heartbeats: unknown } {
    return {
      members: this.members.toJSON(),
      membership: this.membership.toJSON(),
      heartbeats: this.heartbeats.toJSON(),
    };
  }

  importState(data: { members: Record<string, unknown>; membership: unknown; heartbeats: unknown }): void {
    this.members = LWWMap.fromJSON(data.members as any);
    this.membership = ORSet.fromJSON(data.membership as any);
    this.heartbeats = GCounter.fromJSON(data.heartbeats as any);
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
      try { l(event); } catch (_) { /* swallow */ }
    }
  }
}
