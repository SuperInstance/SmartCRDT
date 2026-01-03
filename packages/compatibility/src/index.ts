/**
 * @lsi/compatibility - Version compatibility checking and migration system
 *
 * Main entry point for the compatibility checking system.
 */

export {
  CompatibilityChecker,
  createCompatibilityChecker,
  defaultChecker,
} from './CompatibilityChecker.js';

export type {
  ComponentConstraint,
  IssueSeverity,
  IssueType,
  CompatibilityIssue,
  BreakingChange,
  ComponentVersion,
  ComponentMatrix,
  CompatibilityReport,
  MigrationStep,
  MigrationPath,
  MigrationGuide,
  VersionRangeResult,
} from './CompatibilityChecker.js';
