/**
 * @file ConflictDemo.ts - Visual demonstration of CRDT conflict resolution
 * @description Shows how concurrent edits are merged and conflicts resolved
 * @module collaboration/ConflictDemo
 */

import { CRDTDocumentStore, ConflictResolution } from './CRDTDocumentStore.js';

/**
 * Conflict scenario
 */
interface ConflictScenario {
  name: string;
  description: string;
  setup: () => CRDTDocumentStore[];
  execute: (stores: CRDTDocumentStore[]) => ConflictResolution[];
}

/**
 * Color codes for terminal output
 */
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

/**
 * Conflict Demo Runner
 *
 * Demonstrates various CRDT conflict resolution scenarios:
 * - Concurrent insertions at same position
 * - Concurrent deletions
 * - Overlapping replacements
 * - Multi-way merges
 */
export class ConflictDemo {
  private scenarios: ConflictScenario[] = [];

  constructor() {
    this.setupScenarios();
  }

  /**
   * Setup demo scenarios
   */
  private setupScenarios(): void {
    // Scenario 1: Concurrent insertions at same position
    this.scenarios.push({
      name: 'Concurrent Insertions',
      description: 'Two users insert text at the same position',
      setup: () => {
        const store1 = new CRDTDocumentStore('Hello world');
        const store2 = new CRDTDocumentStore('Hello world');
        return [store1, store2];
      },
      execute: (stores) => {
        const [store1, store2] = stores;

        // Both insert at position 5 (after "Hello")
        const op1 = store1.insert('user1', 5, ' beautiful');
        const op2 = store2.insert('user2', 5, ' amazing');

        // Merge
        const result1 = store1.merge(store2);
        const result2 = store2.merge(store1);

        return [result1, result2];
      }
    });

    // Scenario 2: Concurrent deletions
    this.scenarios.push({
      name: 'Concurrent Deletions',
      description: 'Two users delete different parts of text',
      setup: () => {
        const text = 'The quick brown fox jumps over the lazy dog';
        const store1 = new CRDTDocumentStore(text);
        const store2 = new CRDTDocumentStore(text);
        return [store1, store2];
      },
      execute: (stores) => {
        const [store1, store2] = stores;

        // User1 deletes "quick "
        store1.delete('user1', 4, 6);

        // User2 deletes "lazy "
        store2.delete('user2', 35, 5);

        // Merge
        const result1 = store1.merge(store2);
        const result2 = store2.merge(store1);

        return [result1, result2];
      }
    });

    // Scenario 3: Overlapping edits (conflict)
    this.scenarios.push({
      name: 'Overlapping Edits',
      description: 'Two users edit overlapping regions',
      setup: () => {
        const store1 = new CRDTDocumentStore('Hello world');
        const store2 = new CRDTDocumentStore('Hello world');
        return [store1, store2];
      },
      execute: (stores) => {
        const [store1, store2] = stores;

        // Both try to replace "world" but with different words
        store1.replace('user1', 6, 5, 'there');
        store2.replace('user2', 6, 5, 'universe');

        // Merge - one will win based on clock
        const result1 = store1.merge(store2);
        const result2 = store2.merge(store1);

        return [result1, result2];
      }
    });

    // Scenario 4: Three-way merge
    this.scenarios.push({
      name: 'Three-Way Merge',
      description: 'Three users make concurrent edits',
      setup: () => {
        const text = 'Collaborative editing is powerful';
        const store1 = new CRDTDocumentStore(text);
        const store2 = new CRDTDocumentStore(text);
        const store3 = new CRDTDocumentStore(text);
        return [store1, store2, store3];
      },
      execute: (stores) => {
        const [store1, store2, store3] = stores;

        // User1 appends at end
        store1.insert('user1', 36, ' and fun');

        // User2 inserts in middle
        store2.insert('user2', 28, ' and efficient');

        // User3 replaces word
        store3.replace('user3', 0, 14, 'Real-time teamwork');

        // Merge all
        const result1 = store1.merge(store2);
        store1.merge(store3);
        const result2 = store2.merge(store3);

        return [result1, result2];
      }
    });

    // Scenario 5: Sequential operations
    this.scenarios.push({
      name: 'Sequential Operations',
      description: 'Operations happen in sequence across replicas',
      setup: () => {
        const store1 = new CRDTDocumentStore('Start');
        const store2 = new CRDTDocumentStore('Start');
        return [store1, store2];
      },
      execute: (stores) => {
        const [store1, store2] = stores;

        // User1 makes two edits
        store1.insert('user1', 5, ' with');
        store1.insert('user1', 10, ' CRDT');

        // User2 makes one edit
        store2.insert('user2', 5, ' using');

        // Merge
        const result1 = store1.merge(store2);
        const result2 = store2.merge(store1);

        return [result1, result2];
      }
    });

    // Scenario 6: Rapid concurrent edits
    this.scenarios.push({
      name: 'Rapid Concurrent Edits',
      description: 'Simulate rapid typing from multiple users',
      setup: () => {
        const store1 = new CRDTDocumentStore('');
        const store2 = new CRDTDocumentStore('');
        const store3 = new CRDTDocumentStore('');
        return [store1, store2, store3];
      },
      execute: (stores) => {
        const [store1, store2, store3] = stores;

        // User1 types "The "
        store1.insert('user1', 0, 'The ');

        // User2 types "quick "
        store2.insert('user2', 0, 'quick ');

        // User3 types "brown "
        store3.insert('user3', 0, 'brown ');

        // Merge
        const result1 = store1.merge(store2);
        store1.merge(store3);

        return [result1];
      }
    });
  }

  /**
   * Run all scenarios
   */
  runAll(): void {
    console.log(Colors.bright + Colors.cyan);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     CRDT Conflict Resolution Demo                        ║');
    console.log('║     Visualizing how concurrent edits are merged          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(Colors.reset);

    for (let i = 0; i < this.scenarios.length; i++) {
      this.runScenario(i);
    }

    console.log(Colors.bright + Colors.green);
    console.log('\n✓ All scenarios completed!');
    console.log(Colors.reset);
  }

  /**
   * Run a single scenario
   */
  runScenario(index: number): void {
    const scenario = this.scenarios[index];

    console.log('\n' + Colors.bright + Colors.blue);
    console.log(`\n━━━ Scenario ${index + 1}: ${scenario.name} ━━━`);
    console.log(Colors.reset);
    console.log(Colors.cyan + scenario.description + Colors.reset);

    // Setup
    const stores = scenario.setup();

    // Show initial state
    console.log('\n' + Colors.yellow + 'Initial state:' + Colors.reset);
    stores.forEach((store, i) => {
      console.log(`  Store ${i + 1}: "${this.highlightContent(store.getContent())}"`);
    });

    // Execute
    const results = scenario.execute(stores);

    // Show results
    console.log('\n' + Colors.green + 'After merge:' + Colors.reset);
    stores.forEach((store, i) => {
      const stats = store.getStats();
      console.log(`  Store ${i + 1}:`);
      console.log(`    Content: "${this.highlightContent(store.getContent())}"`);
      console.log(`    Version: ${stats.version}`);
      console.log(`    Operations: ${stats.operationCount}`);
    });

    // Show conflict resolution
    if (results[0]) {
      console.log('\n' + Colors.yellow + 'Merge details:' + Colors.reset);
      results.forEach((result, i) => {
        if (result.conflictCount > 0) {
          console.log(`  ${Colors.red}✗ Conflicts resolved: ${result.conflictCount}${Colors.reset}`);
        } else {
          console.log(`  ${Colors.green}✓ No conflicts${Colors.reset}`);
        }
        console.log(`  Operations applied: ${result.applied.length}`);
        if (result.rejected.length > 0) {
          console.log(`  Operations rejected: ${result.rejected.length}`);
        }
      });
    }

    // Verify convergence
    const converged = this.checkConvergence(stores);
    if (converged) {
      console.log(Colors.green + '  ✓ All stores converged to same state' + Colors.reset);
    } else {
      console.log(Colors.red + '  ✗ Stores diverged!' + Colors.reset);
    }
  }

  /**
   * Check if all stores have converged
   */
  private checkConvergence(stores: CRDTDocumentStore[]): boolean {
    if (stores.length === 0) return true;

    const content = stores[0].getContent();
    return stores.every((store) => store.getContent() === content);
  }

  /**
   * Highlight content changes
   */
  private highlightContent(content: string): string {
    return Colors.bright + content + Colors.reset;
  }

  /**
   * Run interactive demo
   */
  async runInteractive(): Promise<void> {
    console.log(Colors.bright + Colors.cyan);
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     Interactive CRDT Conflict Demo                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(Colors.reset);

    let running = true;

    while (running) {
      console.log(Colors.bright + 'Available scenarios:' + Colors.reset);
      this.scenarios.forEach((scenario, i) => {
        console.log(`  ${i + 1}. ${scenario.name}`);
      });
      console.log('  0. Exit\n');

      // Wait for user input (simulate for demo)
      console.log(Colors.yellow + 'Running scenario 1 (Concurrent Insertions)...' + Colors.reset);
      this.runScenario(0);

      // In real interactive mode, would wait for actual user input
      running = false;
    }
  }
}

/**
 * Run demo if executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new ConflictDemo();

  const mode = process.argv[2];

  if (mode === '--interactive' || mode === '-i') {
    demo.runInteractive();
  } else {
    demo.runAll();
  }
}
