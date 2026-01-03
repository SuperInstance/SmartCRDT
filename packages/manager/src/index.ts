/**
 * @lsi/manager - Component Lifecycle Management
 *
 * Complete lifecycle management for Aequor components including:
 * - Pull components from remote registry
 * - Install components locally
 * - Run components as processes
 * - Update components to new versions
 * - Remove components and cleanup
 */

// Core exports
export {
  ComponentManager,
  ComponentStateDatabase,
  ComponentLockManager,
} from './ComponentManager.js';

// Type exports
export type {
  ComponentStatus,
  ComponentState,
  DownloadProgress,
  VerificationResult,
  RepairResult,
  CleanOptions,
  ComponentManifest,
  AequorConfig,
  ComponentInfo,
  ComponentEvent,
  ComponentEventType,
  EventListener,
} from './ComponentManager.js';

// Download manager exports
export {
  DownloadManager,
  BatchDownloadManager,
  createDefaultDownloadConfig,
  formatBytes,
  formatDuration,
} from './DownloadManager.js';

// Download manager types
export type {
  DownloadProgress as DownloadManagerProgress,
  DownloadConfig,
  DownloadTask,
  ExtractionResult,
  DownloadStatistics,
} from './DownloadManager.js';
