/**
 * @file index.ts - Main entry point for @lsi/fleet-collab
 * @module @lsi/fleet-collab
 *
 * CRDT-based multi-agent collaboration layer for fleet coordination.
 *
 * @example
 * ```typescript
 * import { FleetCollabStore, FleetHttpApi } from '@lsi/fleet-collab';
 *
 * // Create a store for this agent
 * const store = new FleetCollabStore('agent-1');
 *
 * // Create tasks
 * const task = store.taskBoard.createTask('Fix bug', '...', TaskPriority.HIGH);
 *
 * // Claim and complete
 * store.taskBoard.claimTask(task.id, 'agent-1');
 * store.taskBoard.completeTask(task.id, 'agent-1');
 *
 * // Start HTTP API
 * const api = new FleetHttpApi({ store, port: 3456 });
 * await api.start();
 * ```
 */

// Types
export * from './types.js';

// CRDT Primitives
export {
  GCounter,
  PNCounter,
  LWWRegister,
  ORSet,
  LWWMap,
} from './crdt-primitives.js';

// Collaboration components
export { TaskBoard } from './task-board.js';
export { KnowledgeBase } from './knowledge-base.js';
export { FleetState } from './fleet-state.js';
export { MetricsAggregator, type MetricSnapshot } from './metrics.js';
export { ConfigRegistry } from './config-registry.js';
export { MembershipRegistry, type MembershipInfo } from './membership.js';

// Unified store
export { FleetCollabStore } from './crdt-store.js';

// HTTP API
export { FleetHttpApi, type HttpApiOptions } from './api.js';
