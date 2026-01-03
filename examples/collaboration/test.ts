/**
 * @file test.ts - Test suite for CRDT collaboration features
 * @description Comprehensive tests for document store and conflict resolution
 * @module collaboration/test
 */

import { CRDTDocumentStore, ConflictResolution } from './CRDTDocumentStore.js';

/**
 * Test result
 */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Test suite runner
 */
class TestRunner {
  private results: TestResult[] = [];

  /**
   * Run a test
   */
  async test(name: string, fn: () => void | Promise<void>): Promise<void> {
    const start = Date.now();

    try {
      await fn();
      this.results.push({
        name,
        passed: true,
        duration: Date.now() - start
      });
      console.log(`  ✓ ${name}`);
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: (error as Error).message,
        duration: Date.now() - start
      });
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${(error as Error).message}`);
    }
  }

  /**
   * Print summary
   */
  printSummary(): void {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const duration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n' + '='.repeat(60));
    console.log(`Tests: ${passed}/${total} passed`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(60));

    if (passed === total) {
      console.log('\n✓ All tests passed!\n');
    } else {
      console.log('\n✗ Some tests failed\n');
      process.exit(1);
    }
  }
}

/**
 * Assertion utilities
 */
function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assertNotEqual<T>(actual: T, unexpected: T, message?: string): void {
  if (actual === unexpected) {
    throw new Error(
      message || `Expected value to not equal ${JSON.stringify(unexpected)}`
    );
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message || 'Expected value to be true');
  }
}

function assertFalse(value: boolean, message?: string): void {
  if (value) {
    throw new Error(message || 'Expected value to be false');
  }
}

function assertThrows(fn: () => void, message?: string): void {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch (error) {
    // Expected
  }
}

/**
 * Main test suite
 */
async function runTests(): Promise<void> {
  const runner = new TestRunner();

  console.log('\nCRDT Document Store Tests\n');

  // ============================================================================
  // Basic Operations Tests
  // ============================================================================

  console.log('\nBasic Operations:');

  await runner.test('Create empty document', () => {
    const store = new CRDTDocumentStore();
    assertEqual(store.getContent(), '');
    assertEqual(store.getVersion(), 0);
  });

  await runner.test('Create document with initial content', () => {
    const store = new CRDTDocumentStore('Hello');
    assertEqual(store.getContent(), 'Hello');
  });

  await runner.test('Insert at beginning', () => {
    const store = new CRDTDocumentStore('world');
    store.insert('user1', 0, 'Hello ');
    assertEqual(store.getContent(), 'Hello world');
  });

  await runner.test('Insert at end', () => {
    const store = new CRDTDocumentStore('Hello');
    store.insert('user1', 5, ' world');
    assertEqual(store.getContent(), 'Hello world');
  });

  await runner.test('Insert in middle', () => {
    const store = new CRDTDocumentStore('Helloworld');
    store.insert('user1', 5, ' ');
    assertEqual(store.getContent(), 'Hello world');
  });

  await runner.test('Delete from beginning', () => {
    const store = new CRDTDocumentStore('Hello world');
    store.delete('user1', 0, 6);
    assertEqual(store.getContent(), 'world');
  });

  await runner.test('Delete from end', () => {
    const store = new CRDTDocumentStore('Hello world');
    store.delete('user1', 5, 6);
    assertEqual(store.getContent(), 'Hello');
  });

  await runner.test('Delete from middle', () => {
    const store = new CRDTDocumentStore('Hello beautiful world');
    store.delete('user1', 6, 10);
    assertEqual(store.getContent(), 'Hello world');
  });

  await runner.test('Replace text', () => {
    const store = new CRDTDocumentStore('Hello world');
    store.replace('user1', 6, 5, 'there');
    assertEqual(store.getContent(), 'Hello there');
  });

  await runner.test('Clear document', () => {
    const store = new CRDTDocumentStore('Hello world');
    store.clear();
    assertEqual(store.getContent(), '');
    assertEqual(store.getVersion(), 0);
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  console.log('\nError Handling:');

  await runner.test('Insert at invalid position throws', () => {
    const store = new CRDTDocumentStore('Hello');
    assertThrows(() => store.insert('user1', 10, 'x'));
  });

  await runner.test('Delete at invalid position throws', () => {
    const store = new CRDTDocumentStore('Hello');
    assertThrows(() => store.delete('user1', 10, 1));
  });

  await runner.test('Delete with invalid length throws', () => {
    const store = new CRDTDocumentStore('Hello');
    assertThrows(() => store.delete('user1', 0, 0));
  });

  // ============================================================================
  // Version Tracking Tests
  // ============================================================================

  console.log('\nVersion Tracking:');

  await runner.test('Version increments on insert', () => {
    const store = new CRDTDocumentStore('');
    store.insert('user1', 0, 'a');
    assertEqual(store.getVersion(), 1);
    store.insert('user1', 1, 'b');
    assertEqual(store.getVersion(), 2);
  });

  await runner.test('Version increments on delete', () => {
    const store = new CRDTDocumentStore('ab');
    store.delete('user1', 0, 1);
    assertEqual(store.getVersion(), 1);
  });

  // ============================================================================
  // Multi-User Tests
  // ============================================================================

  console.log('\nMulti-User Operations:');

  await runner.test('Track multiple users', () => {
    const store = new CRDTDocumentStore();
    store.insert('user1', 0, 'Hello');
    store.insert('user2', 5, ' world');
    store.insert('user3', 11, '!');

    const users = store.getActiveUsers();
    assertTrue(users.includes('user1'));
    assertTrue(users.includes('user2'));
    assertTrue(users.includes('user3'));
  });

  await runner.test('Get user operations', () => {
    const store = new CRDTDocumentStore();
    store.insert('user1', 0, 'Hello');
    store.insert('user2', 5, ' world');

    const user1Ops = store.getUserOperations('user1');
    assertEqual(user1Ops.length, 1);
    assertEqual(user1Ops[0].userId, 'user1');

    const user2Ops = store.getUserOperations('user2');
    assertEqual(user2Ops.length, 1);
  });

  // ============================================================================
  // Remote Operation Tests
  // ============================================================================

  console.log('\nRemote Operations:');

  await runner.test('Apply remote insert', () => {
    const store1 = new CRDTDocumentStore('Hello');
    const store2 = new CRDTDocumentStore('Hello');

    const op = store1.insert('user1', 5, ' world');
    store2.applyRemote(op);

    assertEqual(store1.getContent(), store2.getContent());
  });

  await runner.test('Apply remote delete', () => {
    const store1 = new CRDTDocumentStore('Hello world');
    const store2 = new CRDTDocumentStore('Hello world');

    const op = store1.delete('user1', 5, 6);
    store2.applyRemote(op);

    assertEqual(store1.getContent(), store2.getContent());
  });

  await runner.test('Ignore duplicate operations', () => {
    const store = new CRDTDocumentStore('Hello');

    const op = store.insert('user1', 5, ' world');
    const result = store.applyRemote(op); // Should be ignored

    assertEqual(result, null);
  });

  // ============================================================================
  // Conflict Resolution Tests
  // ============================================================================

  console.log('\nConflict Resolution:');

  await runner.test('Concurrent insertions merge correctly', () => {
    const store1 = new CRDTDocumentStore('Hello world');
    const store2 = new CRDTDocumentStore('Hello world');

    store1.insert('user1', 5, ' beautiful');
    store2.insert('user2', 5, ' amazing');

    store1.merge(store2);

    // Both insertions should be present
    assertTrue(store1.getContent().includes('beautiful') || store1.getContent().includes('amazing'));
  });

  await runner.test('Concurrent deletions merge correctly', () => {
    const store1 = new CRDTDocumentStore('The quick brown fox');
    const store2 = new CRDTDocumentStore('The quick brown fox');

    store1.delete('user1', 4, 6); // Remove "quick "
    store2.delete('user2', 10, 5); // Remove "brown "

    store1.merge(store2);

    assertFalse(store1.getContent().includes('quick'));
    assertFalse(store1.getContent().includes('brown'));
  });

  await runner.test('Stores converge after merge', () => {
    const store1 = new CRDTDocumentStore('Hello world');
    const store2 = new CRDTDocumentStore('Hello world');

    store1.insert('user1', 5, ' beautiful');
    store2.insert('user2', 11, '!');

    store1.merge(store2);
    store2.merge(store1);

    // After merging, both should have same content
    const content1 = store1.getContent();
    const content2 = store2.getContent();

    assertEqual(content1, content2);
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  console.log('\nStatistics:');

  await runner.test('Get statistics', () => {
    const store = new CRDTDocumentStore('Hello');
    store.insert('user1', 5, ' world');
    store.insert('user2', 11, '!');

    const stats = store.getStats();

    assertEqual(stats.contentLength, 12);
    assertEqual(stats.version, 2);
    assertEqual(stats.operationCount, 2);
    assertEqual(stats.userCount, 2);
  });

  // ============================================================================
  // Serialization Tests
  // ============================================================================

  console.log('\nSerialization:');

  await runner.test('Export and import snapshot', () => {
    const store1 = new CRDTDocumentStore('Hello world');
    store1.insert('user1', 5, ' beautiful');

    const exported = store1.export();

    const store2 = new CRDTDocumentStore();
    store2.import(exported);

    assertEqual(store1.getContent(), store2.getContent());
    assertEqual(store1.getVersion(), store2.getVersion());
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  console.log('\nEdge Cases:');

  await runner.test('Empty insert', () => {
    const store = new CRDTDocumentStore('Hello');
    store.insert('user1', 5, '');
    assertEqual(store.getContent(), 'Hello');
  });

  await runner.test('Multiple rapid operations', () => {
    const store = new CRDTDocumentStore('');

    for (let i = 0; i < 100; i++) {
      store.insert('user1', i, String.fromCharCode(65 + (i % 26)));
    }

    assertEqual(store.getContent().length, 100);
    assertEqual(store.getVersion(), 100);
  });

  await runner.test('Large document', () => {
    const store = new CRDTDocumentStore('');

    // Create 10KB document
    const text = 'a'.repeat(10000);
    store.insert('user1', 0, text);

    assertEqual(store.getContent().length, 10000);
  });

  // Print summary
  runner.printSummary();
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
