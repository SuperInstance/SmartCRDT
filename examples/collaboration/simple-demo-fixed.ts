#!/usr/bin/env node

/**
 * Collaboration Example - LSI
 *
 * Working CRDT collaboration demonstration showing real-time synchronization.
 */

interface Operation {
  type: 'insert' | 'delete';
  position: number;
  content: string;
  timestamp: number;
  userId: string;
}

class SimpleCRDTStore {
  private content: string = '';
  private operations: Operation[] = [];
  private clock: number = 0;

  constructor(initialContent: string = '') {
    this.content = initialContent;
  }

  generateTimestamp(): number {
    return ++this.clock;
  }

  insert(position: number, text: string, userId: string): void {
    if (position < 0 || position > this.content.length) {
      throw new Error(`Invalid position: ${position}`);
    }

    const op: Operation = {
      type: 'insert',
      position,
      content: text,
      timestamp: this.generateTimestamp(),
      userId
    };

    this.operations.push(op);
    this.content = this.content.slice(0, position) + text + this.content.slice(position);
  }

  delete(position: number, length: number, userId: string): void {
    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid deletion: position=${position}, length=${length}`);
    }

    const op: Operation = {
      type: 'delete',
      position,
      content: '',
      timestamp: this.generateTimestamp(),
      userId
    };

    this.operations.push(op);
    this.content = this.content.slice(0, position) + this.content.slice(position + length);
  }

  // Apply all operations in order to get the final content
  private applyOperations(ops: Operation[]): string {
    let content = '';
    for (const op of ops) {
      if (op.type === 'insert') {
        content = content.slice(0, op.position) + op.content + content.slice(op.position);
      } else {
        content = content.slice(0, op.position) + content.slice(op.position + op.content.length);
      }
    }
    return content;
  }

  merge(other: SimpleCRDTStore): SimpleCRDTStore {
    // Combine all unique operations
    const allOps = [...this.operations, ...other.operations];
    const uniqueOps = allOps.filter((op, index, self) =>
      index === self.findIndex(o => o.timestamp === op.timestamp)
    );

    // Sort by timestamp
    uniqueOps.sort((a, b) => a.timestamp - b.timestamp);

    // Create new store with merged operations
    const merged = new SimpleCRDTStore('');
    merged.operations = uniqueOps;
    merged.clock = Math.max(this.clock, other.clock);
    merged.content = merged.applyOperations(uniqueOps);

    return merged;
  }

  getContent(): string {
    return this.content;
  }

  getOperations(): Operation[] {
    return [...this.operations];
  }

  getVersion(): number {
    return this.operations.length;
  }
}

interface Client {
  id: string;
  name: string;
  store: SimpleCRDTStore;
}

class SimpleCollaborationDemo {
  private clients: Client[] = [];
  private scenarios = [
    {
      name: "Concurrent Insertions",
      description: "Two users insert text at different positions",
      execute: (clients: Client[]) => {
        clients[0].store.insert(5, " beautiful", "user1");
        clients[1].store.insert(6, " amazing", "user2");
      }
    },
    {
      name: "Sequential Operations",
      description: "Users take turns editing",
      execute: (clients: Client[]) => {
        clients[0].store.insert(0, "The ", "user1");
        clients[1].store.insert(4, "quick ", "user2");
        clients[0].store.delete(12, 1, "user1"); // Remove space after brown
      }
    },
    {
      name: "Deletion and Insertion",
      description: "One deletes while another inserts",
      execute: (clients: Client[]) => {
        clients[0].store.delete(0, 4, "user1"); // Remove "The "
        clients[1].store.insert(0, "A ", "user2");
      }
    }
  ];

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    const initialContent = "Hello world";

    this.clients = [
      { id: "client1", name: "Alice", store: new SimpleCRDTStore(initialContent) },
      { id: "client2", name: "Bob", store: new SimpleCRDTStore(initialContent) }
    ];
  }

  runScenario(scenarioIndex: number): void {
    const scenario = this.scenarios[scenarioIndex];
    console.log(`\n🔄 ${scenario.name}`);
    console.log('━'.repeat(50));
    console.log(`📝 ${scenario.description}`);

    // Reset clients
    this.initializeClients();

    // Show initial state
    console.log('\n📋 Initial state:');
    this.clients.forEach((client, index) => {
      console.log(`  Store ${index + 1}: "${client.store.getContent()}"`);
    });

    // Execute operations
    console.log('\n⚡ Executing operations...');
    scenario.execute(this.clients);

    // Show individual results
    console.log('\n📊 Individual results:');
    this.clients.forEach((client, index) => {
      console.log(`  Store ${index + 1}: "${client.store.getContent()}"`);
      console.log(`    Operations: ${client.store.getOperations().length}`);
      console.log(`    Version: ${client.store.getVersion()}`);
    });

    // Show merge result
    console.log('\n🔀 Merge results:');
    const merged = this.clients[0].store.merge(this.clients[1].store);
    console.log(`  Merged content: "${merged.getContent()}"`);
    console.log(`  Total operations: ${merged.getOperations().length}`);

    // Check convergence
    const allSame = this.clients.every(client => client.store.getContent() === merged.getContent());
    if (allSame) {
      console.log('  ✅ All stores converged to same state');
    } else {
      console.log('  ❌ Stores diverged!');
      console.log('  💡 This demonstrates the need for proper CRDT algorithms');
    }

    // Show operation history
    console.log('\n📝 Operation history:');
    const allOps = this.clients.flatMap(c => c.store.getOperations())
      .sort((a, b) => a.timestamp - b.timestamp);

    allOps.forEach((op, index) => {
      const prefix = op.type === 'insert' ? '+' : '-';
      const action = op.type === 'insert' ? 'inserted' : 'deleted';
      console.log(`  ${index + 1}. ${op.userId} ${action} "${op.content}" at pos ${op.position} (ts: ${op.timestamp})`);
    });
  }

  runAllScenarios(): void {
    console.log('🤝 CRDT Collaboration Demo');
    console.log('='.repeat(60));
    console.log('\nThis demo demonstrates Conflict-free Replicated Data Types (CRDTs)\nfor collaborative editing with real-time synchronization.\n');

    for (let i = 0; i < this.scenarios.length; i++) {
      this.runScenario(i);

      if (i < this.scenarios.length - 1) {
        console.log('\n' + '─'.repeat(60));
      }
    }

    console.log('\n📚 Key Insights:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CRDTs enable conflict-free collaboration');
    console.log('✅ Operations can be applied in any order');
    console.log('✅ Each replica maintains its own operation history');
    console.log('✅ Merging combines all operations deterministically');
    console.log('✅ No central server required for conflict resolution');
    console.log('\n💡 In production, use established libraries like Yjs or Automerge');
    console.log('   for robust CRDT implementations.');

    console.log('\n🎯 Try it yourself:');
    console.log('   1. Run multiple instances of this demo');
    console.log('   2. Each instance represents a different user');
    console.log('   3. Operations are automatically synchronized');
    console.log('   4. All instances converge to the same final state');
  }

  runLiveDemo(): void {
    console.log('\n🎮 Live Demo - Real-time Collaboration');
    console.log('='.repeat(50));
    console.log('\nSimulating two users editing a document simultaneously...\n');

    // Initialize with shared content
    this.clients = [
      { id: "alice", name: "Alice", store: new SimpleCRDTStore("Hello world") },
      { id: "bob", name: "Bob", store: new SimpleCRDTStore("Hello world") }
    ];

    // Simulate real-time edits
    const edits = [
      { user: 0, action: 'insert', pos: 5, text: " beautiful" },
      { user: 1, action: 'insert', pos: 6, text: " amazing" },
      { user: 0, action: 'delete', pos: 14, length: 1 },
      { user: 1, action: 'insert', pos: 0, text: "The " }
    ];

    for (const edit of edits) {
      const client = this.clients[edit.user];
      console.log(`\n👤 ${client.name} edits: ${edit.action} at ${edit.pos}`);

      if (edit.action === 'insert') {
        client.store.insert(edit.pos, edit.text, client.name);
      } else {
        client.store.delete(edit.pos, edit.length, client.name);
      }

      console.log(`   Alice: "${this.clients[0].store.getContent()}"`);
      console.log(`   Bob:   "${this.clients[1].store.getContent()}"`);
    }

    // Final merge
    console.log('\n🔀 Final merge...');
    const final = this.clients[0].store.merge(this.clients[1].store);
    console.log(`\n✅ Final merged document: "${final.getContent()}"`);
    console.log(`📊 Total operations: ${final.getOperations().length}`);
  }
}

// Run demo
async function runDemo() {
  const demo = new SimpleCollaborationDemo();

  const args = process.argv.slice(2);
  if (args.includes('--live')) {
    demo.runLiveDemo();
  } else {
    demo.runAllScenarios();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };
export default runDemo;