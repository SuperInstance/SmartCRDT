/**
 * @file membership.ts - CRDT-based fleet membership using OR-Set
 * @module @lsi/fleet-collab/membership
 *
 * Tracks which agents are part of the fleet using an OR-Set,
 * which handles concurrent join/leave operations correctly.
 */

import { AgentId, type CollabEvent, CollabEventType, type EventListener } from './types.js';
import { ORSet } from './crdt-primitives.js';

export interface MembershipInfo {
  agentId: AgentId;
  displayName: string;
  roles: string[];
  joinedAt: number;
  metadata: Record<string, unknown>;
}

export class MembershipRegistry {
  /** OR-Set of agent IDs */
  private memberSet: ORSet<string> = new ORSet();
  /** LWW data per agent */
  private memberData: Map<string, MembershipInfo> = new Map();
  private listeners: Set<EventListener> = new Set();
  private replicaId: AgentId;

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
  }

  /** Add an agent to the fleet */
  join(agentId: AgentId, opts?: { displayName?: string; roles?: string[]; metadata?: Record<string, unknown> }): MembershipInfo {
    this.memberSet.add(agentId, this.replicaId);
    const info: MembershipInfo = {
      agentId,
      displayName: opts?.displayName || agentId,
      roles: opts?.roles || [],
      joinedAt: Date.now(),
      metadata: opts?.metadata || {},
    };
    this.memberData.set(agentId, info);
    this.emit({ type: CollabEventType.AGENT_JOINED, agentId, timestamp: info.joinedAt, payload: { info } });
    return info;
  }

  /** Remove an agent from the fleet */
  leave(agentId: AgentId): void {
    this.memberSet.remove(agentId);
    this.memberData.delete(agentId);
    this.emit({ type: CollabEventType.AGENT_LEFT, agentId, timestamp: Date.now(), payload: {} });
  }

  /** Check if an agent is a member */
  isMember(agentId: AgentId): boolean {
    return this.memberSet.has(agentId);
  }

  /** Get all member IDs */
  getMembers(): string[] {
    return this.memberSet.values();
  }

  /** Get membership info for an agent */
  getMemberInfo(agentId: AgentId): MembershipInfo | undefined {
    return this.memberData.get(agentId);
  }

  /** Get all membership info */
  getAllMemberInfo(): MembershipInfo[] {
    const result: MembershipInfo[] = [];
    for (const agentId of this.memberSet.values()) {
      const info = this.memberData.get(agentId);
      if (info) result.push(info);
    }
    return result;
  }

  /** Find members with a specific role */
  getMembersByRole(role: string): MembershipInfo[] {
    return this.getAllMemberInfo().filter(m => m.roles.includes(role));
  }

  /** Find members with a specific capability (stored in metadata) */
  getMembersWithCapability(capability: string): MembershipInfo[] {
    return this.getAllMemberInfo().filter(m =>
      (m.metadata.capabilities as string[] | undefined)?.includes(capability)
    );
  }

  /** Member count */
  size(): number {
    return this.memberSet.size();
  }

  // ------------------------------------------------------------------
  // MERGE
  // ------------------------------------------------------------------

  merge(other: MembershipRegistry): void {
    // Merge OR-Set handles concurrent add/remove correctly
    this.memberSet.merge(other.memberSet);
    // Merge member data (latest wins by joinedAt)
    for (const [agentId, info] of other.memberData) {
      const existing = this.memberData.get(agentId);
      if (!existing || info.joinedAt > existing.joinedAt) {
        this.memberData.set(agentId, info);
      }
    }
  }

  exportState(): { memberSet: unknown; memberData: Record<string, MembershipInfo> } {
    return {
      memberSet: this.memberSet.toJSON(),
      memberData: Object.fromEntries(this.memberData),
    };
  }

  importState(data: { memberSet: unknown; memberData: Record<string, MembershipInfo> }): void {
    this.memberSet = ORSet.fromJSON(data.memberSet as any);
    this.memberData = new Map(Object.entries(data.memberData || {}));
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
