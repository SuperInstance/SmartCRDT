/**
 * @lsi/state - Persistence Module
 *
 * State save/load functionality
 */

export {
  StatePersistence,
  LocalStorageBackend,
  MemoryBackend,
  JSONSerializer,
} from "./StatePersistence.js";
export type {
  StorageBackend,
  PersistenceConfig,
  StateSerializer,
} from "./StatePersistence.js";
