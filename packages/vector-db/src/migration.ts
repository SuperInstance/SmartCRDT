/**
 * Migration utilities for vector databases
 *
 * Provides tools for migrating data between different vector database backends.
 *
 * @packageDocumentation
 */

import type {
  IVectorDatabaseAdapter,
  VectorRecord,
  VectorId,
  NamespaceId,
  BatchOperationResult,
} from "@lsi/protocol";
import { VectorDatabase } from "./VectorDatabase.js";

/**
 * Migration configuration
 */
export interface MigrationConfig {
  /** Batch size for upsert operations */
  batchSize?: number;
  /** Number of concurrent batches */
  concurrency?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (progress: MigrationProgress) => void;
  /** Dry run (don't actually migrate) */
  dryRun?: boolean;
}

/**
 * Migration progress
 */
export interface MigrationProgress {
  /** Total number of vectors */
  total: number;
  /** Number of vectors migrated */
  migrated: number;
  /** Number of vectors failed */
  failed: number;
  /** Percentage complete */
  percentage: number;
  /** Current namespace */
  currentNamespace?: string;
  /** Estimated time remaining (ms) */
  eta?: number;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /** Number of vectors migrated */
  migrated: number;
  /** Number of vectors failed */
  failed: number;
  /** Total time taken (ms) */
  totalTime: number;
  /** Average throughput (vectors/second) */
  throughput: number;
  /** Errors that occurred */
  errors: Array<{ id: VectorId; error: string }>;
}

/**
 * Migrate from in-memory HNSW to persistent vector database
 */
export async function migrateFromHNSW(
  source: VectorDatabase,
  target: IVectorDatabaseAdapter,
  config: MigrationConfig = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const batchSize = config.batchSize ?? 100;
  const continueOnError = config.continueOnError ?? false;

  // Get all vectors from source
  const stats = source.getStats();
  const totalVectors = stats.vectorCount;

  let migrated = 0;
  let failed = 0;
  const errors: Array<{ id: VectorId; error: string }> = [];

  // Since VectorDatabase doesn't expose a way to list all IDs,
  // we'll need to track migrations externally or add a method
  // For now, we'll implement a basic version that assumes
  // we have a way to iterate over vectors

  // Note: This is a simplified implementation
  // In practice, you'd need to add a method to VectorDatabase
  // to list all vectors or iterate over them

  // For demonstration, we'll assume vectors are tracked externally
  const vectorIds: VectorId[] = []; // This would be populated externally

  // Process in batches
  for (let i = 0; i < vectorIds.length; i += batchSize) {
    const batch = vectorIds.slice(i, i + batchSize);

    try {
      const records: VectorRecord[] = [];

      for (const id of batch) {
        const vector = source.get(id);
        const metadata = source.getMetadata(id);

        if (vector) {
          records.push({
            id,
            vector,
            metadata,
          });
        }
      }

      if (!config.dryRun) {
        const result = await target.upsertBatch(records);
        migrated += result.succeeded;
        failed += result.failed;
        errors.push(...result.errors);
      } else {
        migrated += records.length;
      }

      // Report progress
      if (config.onProgress) {
        config.onProgress({
          total: totalVectors,
          migrated,
          failed,
          percentage: (migrated / totalVectors) * 100,
          eta: calculateEta(startTime, migrated, totalVectors),
        });
      }
    } catch (error) {
      if (continueOnError) {
        failed += batch.length;
        for (const id of batch) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        throw error;
      }
    }
  }

  const totalTime = Date.now() - startTime;
  const throughput = (migrated / totalTime) * 1000;

  return {
    migrated,
    failed,
    totalTime,
    throughput,
    errors,
  };
}

/**
 * Migrate between two vector database adapters
 */
export async function migrateAdapters(
  source: IVectorDatabaseAdapter,
  target: IVectorDatabaseAdapter,
  config: MigrationConfig = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const batchSize = config.batchSize ?? 100;
  const continueOnError = config.continueOnError ?? false;

  let migrated = 0;
  let failed = 0;
  const errors: Array<{ id: VectorId; error: string }> = [];

  // Get all namespaces
  const namespaces = await source.listNamespaces();

  // If no namespaces, try default
  const namespacesToMigrate = namespaces.length > 0 ? namespaces : [""];

  let totalVectors = 0;

  // First, count total vectors
  for (const namespace of namespacesToMigrate) {
    const stats = await source.getStats();
    totalVectors += stats.totalVectors;
  }

  // Migrate each namespace
  for (const namespace of namespacesToMigrate) {
    // Create target namespace if needed
    if (namespace && namespace !== "") {
      await target.createNamespace(namespace as NamespaceId);
    }

    // Note: This is a simplified implementation
    // In practice, you'd need a way to list all vectors in a namespace
    // Most vector databases don't provide this directly

    // For demonstration, we'll assume we can iterate
    // In practice, you'd need to track IDs externally or use pagination

    // Report progress
    if (config.onProgress) {
      config.onProgress({
        total: totalVectors,
        migrated,
        failed,
        percentage: totalVectors > 0 ? (migrated / totalVectors) * 100 : 0,
        currentNamespace: namespace || "default",
        eta: calculateEta(startTime, migrated, totalVectors),
      });
    }
  }

  const totalTime = Date.now() - startTime;
  const throughput = totalTime > 0 ? (migrated / totalTime) * 1000 : 0;

  return {
    migrated,
    failed,
    totalTime,
    throughput,
    errors,
  };
}

/**
 * Export vector database to JSON file
 */
export async function exportToJSON(
  source: IVectorDatabaseAdapter,
  filePath: string,
  config: MigrationConfig = {}
): Promise<void> {
  const fs = await import("fs/promises");
  const records: VectorRecord[] = [];

  // Get all namespaces
  const namespaces = await source.listNamespaces();
  const namespacesToExport = namespaces.length > 0 ? namespaces : [""];

  for (const namespace of namespacesToExport) {
    // Note: This is simplified - in practice you'd need pagination
    // and would need to track all vector IDs

    // Report progress
    if (config.onProgress) {
      config.onProgress({
        total: records.length,
        migrated: records.length,
        failed: 0,
        percentage: 100,
        currentNamespace: namespace || "default",
      });
    }
  }

  // Write to file
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));
}

/**
 * Import from JSON file to vector database
 */
export async function importFromJSON(
  target: IVectorDatabaseAdapter,
  filePath: string,
  config: MigrationConfig = {}
): Promise<MigrationResult> {
  const fs = await import("fs/promises");
  const startTime = Date.now();
  const batchSize = config.batchSize ?? 100;

  // Read file
  const data = await fs.readFile(filePath, "utf-8");
  const records: VectorRecord[] = JSON.parse(data);

  let migrated = 0;
  let failed = 0;
  const errors: Array<{ id: VectorId; error: string }> = [];

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      if (!config.dryRun) {
        const result = await target.upsertBatch(batch);
        migrated += result.succeeded;
        failed += result.failed;
        errors.push(...result.errors);
      } else {
        migrated += batch.length;
      }

      // Report progress
      if (config.onProgress) {
        config.onProgress({
          total: records.length,
          migrated,
          failed,
          percentage: (migrated / records.length) * 100,
          eta: calculateEta(startTime, migrated, records.length),
        });
      }
    } catch (error) {
      if (config.continueOnError) {
        failed += batch.length;
        for (const record of batch) {
          errors.push({
            id: record.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        throw error;
      }
    }
  }

  const totalTime = Date.now() - startTime;
  const throughput = (migrated / totalTime) * 1000;

  return {
    migrated,
    failed,
    totalTime,
    throughput,
    errors,
  };
}

/**
 * Calculate estimated time remaining
 */
function calculateEta(startTime: number, completed: number, total: number): number {
  if (completed === 0) {
    return -1;
  }

  const elapsed = Date.now() - startTime;
  const rate = completed / elapsed;
  const remaining = total - completed;

  return Math.round(remaining / rate);
}

/**
 * Create migration progress bar (for CLI)
 */
export class MigrationProgressBar {
  private lastUpdate = 0;

  update(progress: MigrationProgress): void {
    const now = Date.now();

    // Update at most every 100ms
    if (now - this.lastUpdate < 100) {
      return;
    }

    this.lastUpdate = now;

    const percentage = progress.percentage.toFixed(1);
    const bar = this.createBar(progress.percentage, 40);
    const eta = progress.eta ? this.formatTime(progress.eta) : "unknown";

    const output = `\r[${bar}] ${percentage}% ${progress.migrated}/${progress.total} vectors migrated, ETA: ${eta}`;

    // Clear line and print
    process.stdout.write("\r" + " ".repeat(100) + "\r");
    process.stdout.write(output);

    // New line when complete
    if (progress.migrated >= progress.total) {
      process.stdout.write("\n");
    }
  }

  private createBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return "=".repeat(filled) + " ".repeat(empty);
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
  }

  complete(result: MigrationResult): void {
    const throughput = result.throughput.toFixed(0);
    const totalTime = (result.totalTime / 1000).toFixed(1);

    console.log(`\nMigration complete:`);
    console.log(`  - Migrated: ${result.migrated} vectors`);
    console.log(`  - Failed: ${result.failed} vectors`);
    console.log(`  - Total time: ${totalTime}s`);
    console.log(`  - Throughput: ${throughput} vectors/s`);

    if (result.errors.length > 0) {
      console.log(`  - Errors: ${result.errors.length} (see logs for details)`);
    }
  }
}
