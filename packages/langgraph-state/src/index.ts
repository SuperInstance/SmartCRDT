/**
 * @lsi/langgraph-state - Advanced State Management for LangGraph
 *
 * Multi-scope, versioned, persistent state with conflict resolution
 * for complex LangGraph applications.
 */

// ============================================================================
// Core Types
// ============================================================================

export * from "./types.js";

// ============================================================================
// State Manager
// ============================================================================

export { AdvancedStateManager, createStateManager } from "./StateManager.js";

// ============================================================================
// Reducers
// ============================================================================

export {
  mergeReducer,
  replaceReducer,
  appendReducer,
  prependReducer,
  deleteReducer,
  updateReducer,
  toggleReducer,
  incrementReducer,
  decrementReducer,
  filterReducer,
  mapReducer,
  setReducer,
  removeReducer,
  unionReducer,
  intersectionReducer,
  differenceReducer,
  batchReducer,
  conditionalReducer,
  composeReducers,
  createReducerMap,
  ReducerRegistry,
  reducerFromStrategy,
  applyReducerWithContext,
  globalReducerRegistry,
} from "./reducers.js";

// ============================================================================
// Persistence
// ============================================================================

export {
  MemoryPersistence,
  FilePersistence,
  PostgreSQLPersistence,
  RedisPersistence,
  StateSerializer,
  createPersistenceBackend,
} from "./persistence.js";

export type { PersistedState, StatePersistenceBackend } from "./persistence.js";

// ============================================================================
// History
// ============================================================================

export { StateHistoryManager, createHistoryManager } from "./history.js";

export type {
  HistoryEntry,
  StateTimeline,
  TimeTravelSession,
  HistoryFilter,
  StateComparison,
} from "./history.js";

// ============================================================================
// Validation
// ============================================================================

export {
  StateValidator,
  TypeValidator,
  createBuiltInSchemas,
  createValidator,
  validateState,
  createSchema,
  validateNestedProperty,
} from "./validation.js";

export type { ValidationConstraint, SchemaDefinition } from "./validation.js";

// ============================================================================
// Conflict Resolution
// ============================================================================

export {
  ConflictResolver,
  ConflictStrategy,
  LastWriteWinsStrategy,
  FirstWriteWinsStrategy,
  OperationalTransformStrategy,
  CRDTStrategy,
  VectorClock,
  threeWayMerge,
  createConflictResolver,
} from "./conflict.js";

// ============================================================================
// Middleware
// ============================================================================

export {
  StateMiddlewareManager,
  LoggingMiddleware,
  AnalyticsMiddleware,
  ValidationMiddleware,
  TransformationMiddleware,
  RateLimitMiddleware,
  SnapshotMiddleware,
  ErrorHandlingMiddleware,
  CacheMiddleware,
  EventEmitterMiddleware,
  createLoggingMiddleware,
  createAnalyticsMiddleware,
  createValidationMiddleware,
  createTransformationMiddleware,
  createRateLimitMiddleware,
  createSnapshotMiddleware,
  createErrorHandlingMiddleware,
  createCacheMiddleware,
  createEventEmitterMiddleware,
  composeMiddleware,
} from "./middleware.js";

export type {
  AnalyticsMetric,
  StateTransformer,
  SnapshotTrigger,
  CacheEntry,
  EventListener,
} from "./middleware.js";

// ============================================================================
// Integration
// ============================================================================

export {
  LangGraphStateManager,
  CoAgentsStateSynchronizer,
  VLJEPAStateManager,
  A2UIStateManager,
  IntegratedStateManager,
  createLangGraphStateManager,
  createCoAgentsStateSynchronizer,
  createVLJEPAStateManager,
  createA2UIStateManager,
  createIntegratedStateManager,
} from "./integration.js";

export type {
  CoAgentsStateSyncConfig,
  VLJEPAEmbeddingState,
  A2UIComponentState,
} from "./integration.js";
