#!/usr/bin/env node

/**
 * Migration Script: In-Memory to ChromaDB
 *
 * Migrates existing in-memory vector data to persistent ChromaDB storage.
 *
 * Usage:
 *   node scripts/migrate-to-chromadb.ts
 *   node scripts/migrate-to-chromadb.ts --batch-size 50
 *   node scripts/migrate-to-chromadb.ts --verify --progress
 *
 * Environment Variables:
 *   CHROMA_HOST - ChromaDB server host (default: localhost)
 *   CHROMA_PORT - ChromaDB server port (default: 8000)
 *   CHROMA_COLLECTION - Collection name (default: lsi_vectors)
 */

import { MemoryAdapter } from '../packages/core/src/vectordb/MemoryAdapter.js';
import { ChromaDbAdapterEnhanced } from '../packages/core/src/vectordb/ChromaDbAdapter.enhanced.js';
import { VectorDbMigration } from '../packages/core/src/vectordb/migration.js';
import * as readline from 'readline';

interface MigrationOptions {
  batchSize: number;
  verify: boolean;
  showProgress: boolean;
  backup: boolean;
  backupPath: string;
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    batchSize: 100,
    verify: false,
    showProgress: false,
    backup: false,
    backupPath: './backups/memory-backup.json',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
      case '-b':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--verify':
      case '-v':
        options.verify = true;
        break;
      case '--progress':
      case '-p':
        options.showProgress = true;
        break;
      case '--backup':
        options.backup = true;
        break;
      case '--backup-path':
        options.backupPath = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
ChromaDB Migration Script

Usage:
  node scripts/migrate-to-chromadb.ts [options]

Options:
  -b, --batch-size <size>     Batch size for migration (default: 100)
  -v, --verify                Verify data after migration
  -p, --progress              Show progress during migration
  --backup                    Create backup before migration
  --backup-path <path>        Backup file path (default: ./backups/memory-backup.json)
  -h, --help                  Show this help message

Environment Variables:
  CHROMA_HOST                 ChromaDB host (default: localhost)
  CHROMA_PORT                 ChromaDB port (default: 8000)
  CHROMA_COLLECTION           Collection name (default: lsi_vectors)

Example:
  node scripts/migrate-to-chromadb.ts --batch-size 50 --verify --progress
`);
}

// Confirm with user before proceeding
async function confirmMigration(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Progress bar
function showProgressBar(current: number, total: number, width: number = 50): void {
  const percentage = (current / total) * 100;
  const filled = Math.round((width * percentage) / 100);
  const empty = width - filled;

  process.stdout.write('\r[');
  process.stdout.write('='.repeat(filled));
  process.stdout.write(' '.repeat(empty));
  process.stdout.write(`] ${percentage.toFixed(1)}% (${current}/${total})`);

  if (current === total) {
    process.stdout.write('\n');
  }
}

// Main migration function
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        ChromaDB Migration: In-Memory → ChromaDB            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const options = parseOptions();

  // Display configuration
  console.log('Configuration:');
  console.log(`  Batch size: ${options.batchSize}`);
  console.log(`  Verify: ${options.verify ? 'Yes' : 'No'}`);
  console.log(`  Show progress: ${options.showProgress ? 'Yes' : 'No'}`);
  console.log(`  Backup: ${options.backup ? 'Yes' : 'No'}`);
  if (options.backup) {
    console.log(`  Backup path: ${options.backupPath}`);
  }
  console.log('');
  console.log('ChromaDB Configuration:');
  console.log(`  Host: ${process.env.CHROMA_HOST || 'localhost'}`);
  console.log(`  Port: ${process.env.CHROMA_PORT || '8000'}`);
  console.log(`  Collection: ${process.env.CHROMA_COLLECTION || 'lsi_vectors'}`);
  console.log('');

  // Confirm migration
  const confirmed = await confirmMigration('Do you want to proceed with the migration?');
  if (!confirmed) {
    console.log('\nMigration cancelled.');
    process.exit(0);
  }

  console.log('\nStarting migration...\n');

  try {
    // Create in-memory adapter (simulating existing data)
    console.log('1. Creating in-memory database...');
    const memoryDb = new MemoryAdapter({
      debug: false,
      initialCapacity: 1000,
    });

    // For demonstration, add some sample data
    // In real usage, this data would already exist
    const sampleDocs = generateSampleDocuments(100);
    console.log(`   Adding ${sampleDocs.length} sample documents...`);
    await memoryDb.addDocuments(sampleDocs);

    const memoryCount = await memoryDb.count();
    console.log(`   ✓ In-memory database has ${memoryCount} documents\n`);

    // Create backup if requested
    if (options.backup) {
      console.log('2. Creating backup...');
      const backupResult = await VectorDbMigration.backupToFile(
        memoryDb,
        options.backupPath,
        { onProgress: options.showProgress ? createProgressCallback('Backup') : undefined }
      );

      if (backupResult.success) {
        console.log(`   ✓ Backup saved to ${options.backupPath}`);
        console.log(`   ✓ Backed up ${backupResult.transferred} documents\n`);
      } else {
        throw new Error(`Backup failed: ${backupResult.error}`);
      }
    }

    // Create ChromaDB adapter
    console.log('3. Connecting to ChromaDB...');
    const chromaDb = new ChromaDbAdapterEnhanced({
      host: process.env.CHROMA_HOST || 'localhost',
      port: parseInt(process.env.CHROMA_PORT || '8000', 10),
      collectionName: process.env.CHROMA_COLLECTION || 'lsi_vectors',
      enableMetrics: true,
      debug: false,
    });

    // Test connection
    const isHealthy = await chromaDb.healthCheck();
    if (!isHealthy) {
      throw new Error('Cannot connect to ChromaDB. Please ensure the server is running.');
    }
    console.log('   ✓ Connected to ChromaDB\n');

    // Perform migration
    console.log('4. Migrating documents...');
    const startTime = Date.now();

    const result = await VectorDbMigration.migrate(memoryDb, chromaDb, {
      batchSize: options.batchSize,
      verify: options.verify,
      onProgress: options.showProgress ? createProgressCallback('Migration') : undefined,
    });

    const elapsed = Date.now() - startTime;

    console.log('\n');
    console.log('5. Migration Results:');
    console.log(`   Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    console.log(`   Total documents: ${result.total}`);
    console.log(`   Transferred: ${result.transferred}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Duration: ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`   Avg speed: ${(result.transferred / (elapsed / 1000)).toFixed(2)} docs/s`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    // Verify ChromaDB has the data
    const chromaCount = await chromaDb.count();
    console.log(`\n   ChromaDB now has ${chromaCount} documents`);

    if (options.verify && chromaCount === result.transferred) {
      console.log('   ✓ Verification passed');
    } else if (options.verify) {
      console.log('   ✗ Verification failed');
    }

    // Show statistics
    const stats = await chromaDb.getStats();
    console.log('\n6. ChromaDB Statistics:');
    console.log(`   Total documents: ${stats.documentCount}`);
    console.log(`   Total size: ${(stats.totalVectorSize / 1024 / 1024).toFixed(2)} MB`);

    if (stats.performance) {
      console.log('\n7. Performance Metrics:');
      console.log(`   Total operations: ${stats.performance.totalOperations}`);
      console.log(`   Successful: ${stats.performance.successfulOperations}`);
      console.log(`   Failed: ${stats.performance.failedOperations}`);
      console.log(`   Avg latency: ${stats.performance.averageLatency.toFixed(2)}ms`);
    }

    // Close connections
    await memoryDb.close();
    await chromaDb.close();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                   Migration Complete!                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Update your .env file:');
    console.log('     VECTOR_DB_TYPE=chroma');
    console.log('  2. Restart your application');
    console.log('  3. Verify data integrity');
    console.log('  4. Remove old in-memory data if satisfied');
    console.log('');

  } catch (error) {
    console.error('\n✗ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function parseOptions(): MigrationOptions {
  return {
    batchSize: 100,
    verify: false,
    showProgress: false,
    backup: false,
    backupPath: './backups/memory-backup.json',
  };
}

function generateSampleDocuments(count: number): any[] {
  const docs = [];
  const categories = ['code', 'documentation', 'test', 'config'];
  const sources = ['file1.ts', 'file2.ts', 'file3.md', 'config.json'];

  for (let i = 0; i < count; i++) {
    docs.push({
      id: `doc-${i}`,
      vector: new Float32Array(384).map(() => Math.random()),
      content: `Sample document content ${i}`,
      metadata: {
        category: categories[i % categories.length],
        source: sources[i % sources.length],
        index: i,
        timestamp: Date.now(),
      },
    });
  }

  return docs;
}

function createProgressCallback(stage: string) {
  let lastUpdate = 0;
  const updateInterval = 1000; // Update every second

  return (progress: any) => {
    const now = Date.now();
    if (now - lastUpdate >= updateInterval || progress.percentage >= 100) {
      showProgressBar(progress.transferred, progress.total);
      lastUpdate = now;
    }
  };
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
